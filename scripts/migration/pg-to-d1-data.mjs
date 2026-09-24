#!/usr/bin/env node
/**
 * Copies production Postgres data into Cloudflare D1, converting types.
 *
 * Companion to pg-to-d1-schema.mjs, which creates the tables. This is the ETL, and like the
 * schema script it exists to be **run early and repeatedly** so the conversion is proven
 * long before the cutover window, not debugged inside it.
 *
 * ## Type conversion
 *
 * | Postgres        | D1      | Conversion |
 * |-----------------|---------|------------|
 * | uuid            | TEXT    | verbatim — already a string over the wire |
 * | timestamptz     | TEXT    | ISO 8601, so lexicographic order stays chronological |
 * | date            | TEXT    | `YYYY-MM-DD`, no time component |
 * | boolean         | INTEGER | 0 / 1 |
 * | jsonb, json     | TEXT    | `JSON.stringify` |
 * | text[]          | TEXT    | `JSON.stringify` |
 * | inet            | TEXT    | verbatim |
 * | numeric(p,s)    | INTEGER | **`Math.round(value * 10^s)`** — minor units |
 *
 * ## The scaling is the dangerous part
 *
 * `numeric` becomes an integer count of minor units because SQLite has no exact decimal and
 * REAL would silently corrupt currency. The scale comes from the live catalog rather than a
 * hardcoded list, so a column whose precision changes cannot quietly drift out of sync.
 *
 * Every scaled value is verified to round-trip: `scaled / 10^s` must equal the source value,
 * and the row is rejected if it does not. That catches a precision the schema did not
 * anticipate instead of writing a wrong number.
 *
 * ## Ordering
 *
 * Tables are inserted in topological FK order (parents first) so foreign keys hold without
 * disabling enforcement. A cycle would be reported rather than worked around silently.
 *
 * ## This is a snapshot
 *
 * Production keeps taking writes, so a run done today is stale tomorrow. `--truncate` makes
 * re-running cheap, and the real migration runs this once more inside the freeze.
 *
 * Usage:
 *   node scripts/migration/pg-to-d1-data.mjs --dry-run
 *   node scripts/migration/pg-to-d1-data.mjs --truncate
 *   node scripts/migration/pg-to-d1-data.mjs --truncate --only applications,profiles
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DB_NAME = "careerotter";
const DRY_RUN = process.argv.includes("--dry-run");
const TRUNCATE = process.argv.includes("--truncate");
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i === -1 ? null : new Set(process.argv[i + 1].split(","));
})();

/**
 * D1 rejects a statement over roughly 100 KB with SQLITE_TOOBIG, so batches are sized by
 * BYTES rather than row count.
 *
 * Row count alone is not a usable proxy here: resume_analysis, job_fit_analysis and
 * interview_prep each store a whole AI response as jsonb, so a single row can be tens of
 * kilobytes while a row of email_preferences is a few hundred bytes. Fifty of the former
 * blows the limit; fifty of the latter wastes round trips.
 */
const MAX_STATEMENT_BYTES = 60_000;
/** A single row larger than this cannot be batched at all and is sent on its own. */
const MAX_ROWS_PER_BATCH = 200;

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

const sql = postgres(fromEnvFile("POSTGRES_URL"), {
  prepare: false,
  max: 1,
  // Keep timestamps as the raw Postgres text so conversion is explicit and inspectable,
  // rather than going through a JS Date and back.
  types: {
    date: { to: 1184, from: [1082, 1114, 1184], serialize: (v) => v, parse: (v) => v },
  },
});

/** SQLite string literal. Doubling single quotes is the only escape SQLite needs. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function convert(value, col) {
  if (value === null || value === undefined) return "NULL";

  switch (col.data_type) {
    case "boolean":
      return value ? "1" : "0";

    case "numeric": {
      const scale = col.numeric_scale ?? 0;
      const factor = 10 ** scale;
      const scaled = Math.round(Number(value) * factor);
      // Reject rather than silently write a wrong number.
      if (Math.abs(scaled / factor - Number(value)) > Number.EPSILON * 10) {
        throw new Error(
          `${col.table_name}.${col.column_name}: ${value} does not round-trip at scale ${scale}`
        );
      }
      return String(scaled);
    }

    case "integer":
    case "bigint":
    case "smallint":
      return String(value);

    case "double precision":
    case "real":
      return String(Number(value));

    case "jsonb":
    case "json":
    case "ARRAY":
      return lit(JSON.stringify(value));

    case "timestamp with time zone":
    case "timestamp without time zone":
      // Postgres native text ("2025-06-04 22:33:26.314059+00") -> ISO 8601.
      return lit(String(value).replace(" ", "T").replace(/([+-])(\d{2})$/, "$1$2:00"));

    default:
      return lit(value);
  }
}

/** Kahn's algorithm over the FK graph, so parents are inserted before children. */
function topologicalOrder(tables, edges) {
  const incoming = new Map(tables.map((t) => [t, new Set()]));
  for (const [child, parent] of edges) {
    if (child !== parent && incoming.has(child)) incoming.get(child).add(parent);
  }
  const ordered = [];
  const remaining = new Set(tables);
  while (remaining.size) {
    const ready = [...remaining]
      .filter((t) => [...incoming.get(t)].every((p) => !remaining.has(p)))
      .sort();
    if (ready.length === 0) {
      // A genuine cycle. Report it instead of guessing an order.
      console.error(`FK cycle among: ${[...remaining].sort().join(", ")}`);
      ordered.push(...[...remaining].sort());
      break;
    }
    for (const t of ready) {
      ordered.push(t);
      remaining.delete(t);
    }
  }
  return ordered;
}

function runOnD1(statements) {
  const scratch = mkdtempSync(join(tmpdir(), "d1-etl-"));
  try {
    const file = join(scratch, "batch.sql");
    writeFileSync(file, statements.join("\n"));
    execFileSync(
      "wrangler",
      ["d1", "execute", DB_NAME, "--remote", "--file", file, "-y"],
      { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"], maxBuffer: 64 * 1024 * 1024 }
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------

const tableRows = await sql`
  select c.relname as t from pg_class c
  where c.relnamespace='public'::regnamespace and c.relkind='r' order by 1`;
let tables = tableRows.map((r) => r.t);
if (ONLY) tables = tables.filter((t) => ONLY.has(t));

const fkRows = await sql`
  select c.relname as child, rc.relname as parent
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_class rc on rc.oid = con.confrelid
  join pg_namespace rn on rn.oid = rc.relnamespace
  where con.contype='f' and rn.nspname='public'`;

const columnRows = await sql`
  select table_name, column_name, data_type, numeric_scale, ordinal_position
  from information_schema.columns
  where table_schema='public' order by table_name, ordinal_position`;

const colsByTable = new Map();
for (const c of columnRows) {
  if (!colsByTable.has(c.table_name)) colsByTable.set(c.table_name, []);
  colsByTable.get(c.table_name).push(c);
}

const ordered = topologicalOrder(
  tables,
  fkRows.map((f) => [f.child, f.parent])
);

console.log(`${ordered.length} table(s) in FK order${DRY_RUN ? "  [DRY RUN]" : ""}`);

if (TRUNCATE && !DRY_RUN) {
  // Reverse order so children are cleared before parents.
  runOnD1([...ordered].reverse().map((t) => `DELETE FROM "${t}";`));
  console.log("cleared existing rows");
}

let totalRows = 0;
const failures = [];

for (const table of ordered) {
  const cols = (colsByTable.get(table) ?? []).filter((c) => c.data_type !== "USER-DEFINED");
  if (cols.length === 0) continue;

  const rows = await sql`select * from ${sql(table)}`;
  if (rows.length === 0) continue;

  const names = cols.map((c) => `"${c.column_name}"`).join(", ");
  const prefix = `INSERT INTO "${table}" (${names}) VALUES\n  `;
  const statements = [];

  try {
    let batch = [];
    let bytes = prefix.length;

    const flush = () => {
      if (batch.length) statements.push(prefix + batch.join(",\n  ") + ";");
      batch = [];
      bytes = prefix.length;
    };

    for (const row of rows) {
      const tuple = `(${cols
        .map((c) => convert(row[c.column_name], { ...c, table_name: table }))
        .join(", ")})`;

      // Flush before appending, so a batch never exceeds the limit rather than being
      // trimmed back afterwards.
      if (batch.length && (bytes + tuple.length > MAX_STATEMENT_BYTES || batch.length >= MAX_ROWS_PER_BATCH)) {
        flush();
      }
      batch.push(tuple);
      bytes += tuple.length + 4;
    }
    flush();
  } catch (e) {
    failures.push({ table, reason: e.message });
    continue;
  }

  if (DRY_RUN) {
    console.log(`  ${table.padEnd(34)} ${String(rows.length).padStart(5)} row(s)`);
    totalRows += rows.length;
    continue;
  }

  try {
    runOnD1(statements);
    console.log(`  ${table.padEnd(34)} ${String(rows.length).padStart(5)} row(s)`);
    totalRows += rows.length;
  } catch (e) {
    // wrangler prints warnings to stderr alongside the real error, and a naive slice shows
    // only the warnings — which cost real debugging time. Pull out the error lines.
    const raw = String(e.stderr ?? e);
    const errorLines = raw
      .split("\n")
      .map((l) => l.replace(/\u001b\[[0-9;]*m/g, "").trim())
      .filter((l) => /error|constraint|syntax|near |failed/i.test(l))
      .filter((l) => !/^.?\s*(WARNING|▲)/.test(l));
    failures.push({
      table,
      reason: (errorLines[0] ?? raw.split("\n")[0] ?? "unknown").slice(0, 200),
    });
  }
}

await sql.end();

console.log(`\n${totalRows} row(s) across ${ordered.length} table(s); ${failures.length} failure(s)`);
for (const f of failures) console.log(`  FAIL ${f.table}\n    ${f.reason}`);
process.exit(failures.length === 0 ? 0 : 1);
