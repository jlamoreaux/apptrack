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
 * ## What is deliberately NOT emitted
 *
 * Functions, triggers, RLS policies, the materialized view, and the GIN full-text index.
 * SQLite supports none of them in the forms used here. Their replacements are app-code
 * (the trigger drain), app-layer tenant scoping, a live aggregate, and FTS5 respectively —
 * each tracked separately in the migration plan.
 *
 * Usage:
 *   node scripts/migration/pg-to-d1-schema.mjs            # write drizzle/d1/0000_baseline.sql
 *   node scripts/migration/pg-to-d1-schema.mjs --stdout   # print instead
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

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

const out = [
  "-- D1 / SQLite baseline, generated from production Postgres by",
  "-- scripts/migration/pg-to-d1-schema.mjs. Do not hand-edit; regenerate.",
  "--",
  "-- Functions, triggers, RLS policies, the materialized view and the GIN full-text index",
  "-- are deliberately absent: SQLite supports none of them as used here. See the script",
  "-- docblock for the type mapping and the numeric-to-minor-units decision.",
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

  out.push(`CREATE TABLE "${table_name}" (`, lines.join(",\n"), ");", "");
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
  console.log(
    `wrote drizzle/d1/0000_baseline.sql — ${tables.length} tables, ` +
      `${columns.length} columns, ${scaleNotes.length} scaled numeric column(s)`
  );
}
