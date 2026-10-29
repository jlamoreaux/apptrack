#!/usr/bin/env node
/**
 * Converts the production Postgres schema into SQLite DDL for Cloudflare D1.
 *
 * ## What this is for
 *
 * The largest unknown in the Cloudflare migration is whether the schema survives SQLite at
 * all. This generates the D1 DDL from production's live catalog and is applied to a real D1
 * database, so the answer is measured rather than assumed. It is a **de-risking artifact**,
 * not the cutover tool: the real migration also needs the data ETL and the ~55 pieces of
 * business logic currently living in plpgsql.
 *
 * ## Type mapping, and why
 *
 * | Postgres              | SQLite  | Note |
 * |-----------------------|---------|------|
 * | uuid                  | TEXT    | No native type. Values stay canonical 36-char strings. |
 * | text / varchar        | TEXT    | Length limits are advisory in SQLite; CHECKs preserved. |
 * | timestamptz / date    | TEXT    | ISO 8601. Keeps lexicographic ordering == chronological. |
 * | boolean               | INTEGER | 0/1. |
 * | integer               | INTEGER | |
 * | jsonb                 | TEXT    | Drizzle `mode: "json"`. Loses operators and GIN indexing. |
 * | text[]                | TEXT    | JSON-encoded array. |
 * | inet                  | TEXT    | |
 * | numeric(p,s)          | INTEGER | **Scaled to minor units — see below.** |
 *
 * ## The money decision
 *
 * SQLite has no exact decimal type. REAL would silently corrupt currency, so every
 * `numeric(p,s)` becomes an INTEGER holding minor units, with the scale recorded in the
 * column comment and the name left unchanged:
 *
 *   comp_entries.base, .bonus, .equity   numeric(12,2) -> INTEGER cents
 *   comp_entries.shares                  numeric(14,4) -> INTEGER 1/10000 share
 *   comp_entries.vest_years              numeric(4,2)  -> INTEGER 1/100 year
 *   stock_prices.price                   numeric(14,4) -> INTEGER 1/10000 unit
 *   subscription_plans.price_monthly/_yearly numeric(10,2) -> INTEGER cents
 *
 * **This is a breaking change to every read and write of those columns** and is the single
 * most important thing to get right in the D1 cutover. The ETL must multiply, and the app
 * must divide at the presentation boundary — not in the query layer, where a missed
 * conversion silently reports someone's salary 100x too high.
 *
 * ## Integrity, not just shape
 *
 * The first version of this script emitted tables and columns only. That was enough to
 * answer "does the schema survive SQLite", but it is NOT a cutover artifact: production
 * carries 28 CHECK constraints, 25 non-primary unique indexes, 56 foreign keys and 123
 * indexes, and SQLite supports essentially all of them. Their absence does not produce
 * errors — it produces a database that accepts two active subscriptions for one user, or
 * a second default resume, and full-scans every `WHERE user_id = ?`. So they are emitted.
 *
 * Expressions in CHECK bodies and partial-index predicates go through
 * `pg-to-sqlite-expr.mjs`, which **throws on anything it does not recognise** rather than
 * emitting a weakened form. Every such failure is collected and printed as a named
 * omission, so nothing is silently dropped.
 *
 * ## What is deliberately NOT emitted
 *
 * Functions, triggers, RLS policies and the materialized view. SQLite supports none of
 * them in the forms used here; their replacements are app-code (the trigger drain),
 * app-layer tenant scoping and a live aggregate, each tracked separately in the plan.
 *
 * Also absent, and reported at the end of a run:
 *
 *   - The two GIN indexes. `to_tsvector(job_description)` needs an FTS5 virtual table,
 *     which is a schema of its own rather than an index; `applicable_plans` is a text[]
 *     stored as JSON, so it needs a json_each() index or a query change.
 *   - The 24 foreign keys from `public` into `auth.users`. There is no `auth.users` in D1 — that table
 *     becomes Better Auth's own, so these are re-pointed at the auth stage, not guessed
 *     at here.
 *
 * Usage:
 *   node scripts/migration/pg-to-d1-schema.mjs            # write drizzle/d1/0000_baseline.sql
 *   node scripts/migration/pg-to-d1-schema.mjs --stdout   # print instead
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { translate, checkBody } from "./pg-to-sqlite-expr.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "drizzle/d1/0000_baseline.sql");

function fromEnvFile(key) {
  for (const f of [".env", ".env.local"]) {
    try {
      const m = readFileSync(join(ROOT, f), "utf-8").match(
        new RegExp(`^${key}=(.*)$`, "m")
      );
      if (m) return m[1].trim().replace(/^"|"$/g, "");
    } catch {
      /* next */
    }
  }
}

/** numeric(p,s) columns become INTEGER minor units; s decides the factor. */
function scaleComment(table, column, scale) {
  const factor = 10 ** scale;
  return `-- ${table}.${column}: numeric scaled to INTEGER minor units (value * ${factor})`;
}

function sqliteType(col) {
  switch (col.data_type) {
    case "uuid":
    case "text":
    case "character varying":
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
    case "inet":
    case "jsonb":
    case "json":
    case "ARRAY":
      return "TEXT";
    case "boolean":
    case "integer":
    case "bigint":
    case "smallint":
      return "INTEGER";
    case "numeric":
      return "INTEGER"; // minor units — see module docblock
    case "double precision":
    case "real":
      return "REAL";
    default:
      return "TEXT";
  }
}

/**
 * Translates a Postgres default into a SQLite-legal one.
 *
 * Returns null where there is no equivalent and the application must supply the value —
 * `gen_random_uuid()` most importantly, since SQLite cannot generate a UUID. Every such
 * column therefore requires the insert path to provide an id explicitly.
 */
function sqliteDefault(col) {
  const d = col.column_default;
  if (!d) return null;
  if (/gen_random_uuid\(\)|uuid_generate_v4\(\)/.test(d)) return null; // app must supply
  if (/^now\(\)|CURRENT_TIMESTAMP/i.test(d)) return "CURRENT_TIMESTAMP";
  if (/^(true|false)$/i.test(d)) return /true/i.test(d) ? "1" : "0";
  if (/^'(.*)'::(text|character varying)$/.test(d)) {
    return `'${d.match(/^'(.*)'::/)[1]}'`;
  }
  if (/^-?\d+(\.\d+)?$/.test(d)) return d;
  if (/^'(\{.*\}|\[.*\])'::jsonb$/.test(d)) {
    return `'${d.match(/^'(.*)'::/)[1]}'`;
  }
  return null; // anything sequence- or expression-based has no SQLite equivalent
}

const sql = postgres(fromEnvFile("POSTGRES_URL"), { prepare: false, max: 1 });

const tables = await sql`
  select c.relname as table_name
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  order by 1`;

const columns = await sql`
  select table_name, column_name, data_type, is_nullable, column_default,
         numeric_precision, numeric_scale, ordinal_position
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position`;

const pks = await sql`
  select tc.table_name, kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
  order by kcu.ordinal_position`;

const checks = await sql`
  select c.relname as table_name, con.conname as name,
         pg_get_constraintdef(con.oid) as def
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'c' and n.nspname = 'public'
  order by 1, 2`;

/**
 * Foreign keys within `public` only.
 *
 * The 48 keys referencing `auth.users` are excluded on purpose: that table does not exist
 * in D1 and its replacement is Better Auth's own user table, so re-pointing them is an
 * auth-stage decision rather than something to invent here. They are counted and reported.
 */
const fks = await sql`
  select c.relname as child, con.conname as name,
         rc.relname as parent, rn.nspname as parent_schema,
         con.confdeltype as on_delete,
         (select array_agg(att.attname order by u.ord)
            from unnest(con.conkey) with ordinality u(attnum, ord)
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = u.attnum
         ) as child_cols,
         (select array_agg(att.attname order by u.ord)
            from unnest(con.confkey) with ordinality u(attnum, ord)
            join pg_attribute att on att.attrelid = con.confrelid and att.attnum = u.attnum
         ) as parent_cols
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_class rc on rc.oid = con.confrelid
  join pg_namespace rn on rn.oid = rc.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and c.relkind = 'r'
  order by 1, 2`;

/**
 * Every non-primary index, unique and plain alike, with its raw Postgres definition.
 *
 * The definition is parsed rather than rebuilt from catalog columns because that is the
 * only place the column ordering, DESC markers and partial predicate appear together.
 */
const indexes = await sql`
  select i.indexname as name, i.tablename as table_name, i.indexdef as def,
         idx.indisunique as is_unique
  from pg_indexes i
  join pg_class ic on ic.relname = i.indexname
    and ic.relnamespace = 'public'::regnamespace
  join pg_index idx on idx.indexrelid = ic.oid
  join pg_class tc on tc.oid = idx.indrelid
  where i.schemaname = 'public' and not idx.indisprimary and tc.relkind = 'r'
  order by i.tablename, i.indexname`;

const byTable = new Map();
for (const c of columns) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
  byTable.get(c.table_name).push(c);
}
const pkByTable = new Map();
for (const p of pks) {
  if (!pkByTable.has(p.table_name)) pkByTable.set(p.table_name, []);
  pkByTable.get(p.table_name).push(p.column_name);
}

const checksByTable = new Map();
for (const c of checks) {
  if (!checksByTable.has(c.table_name)) checksByTable.set(c.table_name, []);
  checksByTable.get(c.table_name).push(c);
}
const fksByTable = new Map();
for (const f of fks) {
  if (!fksByTable.has(f.child)) fksByTable.set(f.child, []);
  fksByTable.get(f.child).push(f);
}

/** Postgres pg_constraint.confdeltype -> the SQLite referential action. */
const ON_DELETE = {
  a: null, // NO ACTION is SQLite's default; emitting it adds noise
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
};

/**
 * Anything that could not be translated, reported at the end of a run.
 *
 * A dropped constraint must be loud. Silence here is the failure mode the whole script
 * exists to avoid.
 */
const omissions = [];

/**
 * Splits a Postgres index definition into its column list and partial predicate.
 *
 * Parsed from `indexdef` rather than rebuilt from catalog columns because that is the only
 * rendering that carries column order, DESC markers and the WHERE clause together.
 */
function parseIndexDef(def) {
  const m = def.match(/USING \w+ \((.*?)\)(?:\s+WHERE\s+(.*))?$/s);
  if (!m) return null;
  return { columns: m[1], where: m[2] ?? null };
}

const out = [
  "-- D1 / SQLite baseline, generated from production Postgres by",
  "-- scripts/migration/pg-to-d1-schema.mjs. Do not hand-edit; regenerate.",
  "--",
  "-- Tables carry their CHECK constraints, unique constraints and foreign keys; indexes",
  "-- follow. Functions, triggers, RLS policies and the materialized view are deliberately",
  "-- absent (SQLite supports none of them as used here), as are the two GIN indexes and",
  "-- the foreign keys into auth.users. See the script docblock.",
  "--",
  "-- Foreign keys are declared INSIDE each CREATE TABLE because SQLite has no",
  "-- ALTER TABLE ADD CONSTRAINT. Forward references to a table created later are legal:",
  "-- SQLite resolves them at DML time, not at DDL time. The ETL still inserts parents",
  "-- first, which is what makes enforcement survive a load.",
  "",
  "PRAGMA foreign_keys = ON;",
  "",
];

const scaleNotes = [];

for (const { table_name } of tables) {
  const cols = byTable.get(table_name) ?? [];
  if (cols.length === 0) continue;

  const pk = pkByTable.get(table_name) ?? [];
  const lines = [];

  for (const col of cols) {
    const type = sqliteType(col);
    if (col.data_type === "numeric" && col.numeric_scale > 0) {
      scaleNotes.push(scaleComment(table_name, col.column_name, col.numeric_scale));
    }
    let line = `  "${col.column_name}" ${type}`;
    // A single-column PK is inlined so SQLite treats it as the rowid alias where integer.
    if (pk.length === 1 && pk[0] === col.column_name) line += " PRIMARY KEY";
    if (col.is_nullable === "NO") line += " NOT NULL";
    const def = sqliteDefault(col);
    if (def) line += ` DEFAULT ${def}`;
    lines.push(line);
  }

  if (pk.length > 1) {
    lines.push(`  PRIMARY KEY (${pk.map((c) => `"${c}"`).join(", ")})`);
  }

  // CHECK constraints. Bodies are deduplicated: weekly_recaps carries two differently
  // named constraints that assert the same thing (EXTRACT(dow) and EXTRACT(isodow) against
  // Monday), and they translate to one identical SQLite expression.
  const seenChecks = new Set();
  for (const chk of checksByTable.get(table_name) ?? []) {
    let body;
    try {
      body = translate(checkBody(chk.def));
    } catch (e) {
      omissions.push(`CHECK ${table_name}.${chk.name}: ${e.message}`);
      continue;
    }
    if (seenChecks.has(body)) continue;
    seenChecks.add(body);
    lines.push(`  CONSTRAINT "${chk.name}" CHECK (${body})`);
  }

  // Unique constraints that SQLite can express inline. A PARTIAL unique index cannot be a
  // table constraint in either engine, so those are left to the index section below.
  for (const idx of indexes) {
    if (idx.table_name !== table_name || !idx.is_unique) continue;
    const parsed = parseIndexDef(idx.def);
    if (!parsed || parsed.where) continue;
    lines.push(`  CONSTRAINT "${idx.name}" UNIQUE (${parsed.columns})`);
  }

  for (const fk of fksByTable.get(table_name) ?? []) {
    if (fk.parent_schema !== "public") {
      omissions.push(
        `FK ${table_name}.${fk.name} -> ${fk.parent_schema}.${fk.parent} ` +
          `(resolved at the Better Auth stage)`
      );
      continue;
    }
    const child = fk.child_cols.map((c) => `"${c}"`).join(", ");
    const parent = fk.parent_cols.map((c) => `"${c}"`).join(", ");
    const action = ON_DELETE[fk.on_delete];
    lines.push(
      `  CONSTRAINT "${fk.name}" FOREIGN KEY (${child}) ` +
        `REFERENCES "${fk.parent}" (${parent})` +
        (action ? ` ON DELETE ${action}` : "")
    );
  }

  out.push(`CREATE TABLE "${table_name}" (`, lines.join(",\n"), ");", "");
}

// --- indexes ---------------------------------------------------------------
// Emitted after every table so a partial predicate referencing a column is always valid.
// Unique indexes without a predicate are already table constraints above and are skipped
// here to avoid declaring the same uniqueness twice.
const indexLines = [];
for (const idx of indexes) {
  if (idx.def.includes("USING gin") || idx.def.includes("USING gist")) {
    omissions.push(
      `INDEX ${idx.name}: ${idx.def.includes("to_tsvector") ? "full-text, needs an FTS5 virtual table" : "array containment, needs json_each() or a query change"}`
    );
    continue;
  }
  const parsed = parseIndexDef(idx.def);
  if (!parsed) {
    omissions.push(`INDEX ${idx.name}: could not parse definition`);
    continue;
  }
  if (idx.is_unique && !parsed.where) continue; // already a UNIQUE table constraint

  let where = "";
  if (parsed.where) {
    try {
      where = ` WHERE ${translate(parsed.where)}`;
    } catch (e) {
      omissions.push(`INDEX ${idx.name} predicate: ${e.message}`);
      continue;
    }
  }
  indexLines.push(
    `CREATE ${idx.is_unique ? "UNIQUE " : ""}INDEX "${idx.name}" ` +
      `ON "${idx.table_name}" (${parsed.columns})${where};`
  );
}

if (indexLines.length) {
  out.push(
    "-- Indexes. The two partial-unique ones carry invariants the application relies on:",
    "--   idx_user_subscriptions_user_active   one active subscription per user",
    "--   idx_user_resumes_one_default_per_user  one default resume per user",
    "",
    ...indexLines,
    ""
  );
}

if (scaleNotes.length) {
  out.push(
    "-- Scaled numeric columns. The ETL multiplies; the app divides at the presentation",
    "-- boundary. A missed conversion here misreports money by orders of magnitude.",
    ...scaleNotes,
    ""
  );
}

await sql.end();

const ddl = out.join("\n");
if (process.argv.includes("--stdout")) {
  console.log(ddl);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, ddl);

  const emitted = (re) => (ddl.match(re) ?? []).length;
  console.log(
    `wrote drizzle/d1/0000_baseline.sql\n` +
      `  ${tables.length} tables, ${columns.length} columns, ` +
      `${scaleNotes.length} scaled numeric column(s)\n` +
      `  ${emitted(/^  CONSTRAINT "[^"]+" CHECK/gm)} CHECK, ` +
      `${emitted(/^  CONSTRAINT "[^"]+" UNIQUE/gm)} UNIQUE, ` +
      `${emitted(/^  CONSTRAINT "[^"]+" FOREIGN KEY/gm)} FK, ` +
      `${emitted(/^CREATE (UNIQUE )?INDEX/gm)} index(es)`
  );
}

// A constraint that exists in production but not in D1 is a real difference in what the
// database will accept, so every one is named. Grouped because 48 identical auth.users
// lines would bury the two that need actual work.
if (omissions.length) {
  const authFks = omissions.filter((o) => o.includes("Better Auth stage"));
  const rest = omissions.filter((o) => !o.includes("Better Auth stage"));
  console.log(`\nNOT emitted (${omissions.length}):`);
  if (authFks.length) {
    console.log(
      `  ${authFks.length} foreign key(s) into auth.users — re-pointed at the Better Auth stage`
    );
  }
  for (const o of rest) console.log(`  ${o}`);
}
