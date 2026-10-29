#!/usr/bin/env node
/**
 * Verifies the D1 copy matches production Postgres.
 *
 * Row counts alone would pass while every money column was wrong by 100x, so this checks
 * three things:
 *
 *   1. **Row count** per table.
 *   2. **Scaled numerics** round-trip — every `numeric(p,s)` value in D1, divided by 10^s,
 *      must equal the Postgres value. This is the check that matters most: SQLite has no
 *      exact decimal, the ETL stores minor units, and a scaling mistake misreports a salary
 *      by orders of magnitude while looking entirely plausible.
 *   3. **JSON columns survived** as parseable JSON rather than "[object Object]".
 *
 * Deliberately NOT a content hash across engines. `md5(string_agg(t::text))` is
 * Postgres-only, and the representations legitimately differ — timestamps are ISO text in
 * D1, booleans are 0/1, numerics are scaled. Comparing rendered rows would report noise as
 * corruption.
 *
 * ## Two things about Postgres access here, both learned by getting them wrong
 *
 * **Row counts are one query, not 51.** Counting each table with its own query inside a
 * `Promise.all` deadlocks: the pool is `max: 1`, so 51 concurrent queries queue behind a
 * single connection and the run never progresses — measured as a hang, or as
 * `read ETIMEDOUT` once the pooler gives up on the idle socket. A single `UNION ALL` over
 * all 51 tables is exact, one round trip, and 0.9s against production versus a hang.
 * Postgres has no compound-SELECT term limit; SQLite does, which is why the D1 side of the
 * same question uses scalar subselects instead.
 *
 * **Every Postgres read happens before the first D1 call, and the pool is closed between
 * them.** A run makes ~50 `wrangler d1 execute` round trips over several minutes. Holding
 * a Postgres connection open across that is pointless and leaves it idle long enough to be
 * dropped, so phase 1 reads everything phase 2 needs and then calls `sql.end()`.
 *
 * Usage:  node scripts/migration/verify-d1-parity.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DB_NAME = "careerotter";
/** Postgres rows sampled per numeric column. Enough to catch a scaling error, not a scan. */
const SAMPLE_SIZE = 50;

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

/**
 * Runs SQL on D1 and returns the parsed rows.
 *
 * Two D1/wrangler constraints are baked in here, both learned the hard way:
 *
 *   - `--command` with `--json` yields clean JSON; `--file` with `--json` interleaves
 *     progress lines ("Checking if file needs uploading") into stdout and breaks parsing.
 *   - D1 rejects a compound SELECT with more than a handful of UNION ALL terms
 *     ("too many terms in compound SELECT", SQLITE_ERROR 7500). Counts across many tables
 *     must therefore be expressed as scalar subselects in a single row, not a union.
 */
function d1(query) {
  const out = execFileSync(
    "wrangler",
    ["d1", "execute", DB_NAME, "--remote", "--json", "--command", query],
    { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
  ).toString();
  return JSON.parse(out)[0].results;
}

// ===========================================================================
// Phase 1 — every Postgres read, then close the pool. See the docblock.
// ===========================================================================

const sql = postgres(fromEnvFile("POSTGRES_URL"), {
  prepare: false,
  max: 1,
  types: {
    date: { to: 1184, from: [1082, 1114, 1184], serialize: (v) => v, parse: (v) => v },
  },
});

const tables = (await sql`
  select relname as t from pg_class
  where relnamespace='public'::regnamespace and relkind='r' order by 1`
).map((r) => r.t);

// One UNION ALL rather than a query per table — see the docblock. Table names come from
// pg_class, not from input, so interpolating them is safe here.
const pgCounts = Object.fromEntries(
  (
    await sql.unsafe(
      tables.map((t) => `select '${t}' t, count(*) c from "${t}"`).join(" union all ")
    )
  ).map((r) => [r.t, Number(r.c)])
);

/**
 * Only real tables were copied to D1, so views and matviews are filtered out here in JS.
 *
 * Not as a `table_name in (subquery)` fragment: nesting a `sql.unsafe()` inside a template
 * is not a composable fragment in postgres.js and the query simply never settles.
 */
const isRealTable = new Set(tables);

const numericCols = (
  await sql`
    select table_name, column_name, numeric_scale
    from information_schema.columns
    where table_schema='public' and data_type='numeric' and numeric_scale > 0
    order by 1,2`
).filter((c) => isRealTable.has(c.table_name));

/**
 * Primary key columns per table, used to line a Postgres row up with its D1 counterpart.
 *
 * Not hardcoded to `id`: most tables use it, but `stock_prices` is keyed on `ticker`, and
 * assuming otherwise made the whole numeric check — the one that catches a 100x money
 * error — die with `column "id" does not exist`.
 */
const pkCols = new Map();
for (const row of await sql`
  select c.relname as table_name,
         array_agg(a.attname order by u.ord) as cols
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  cross join unnest(con.conkey) with ordinality u(attnum, ord)
  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.attnum
  where con.contype = 'p' and n.nspname = 'public'
  group by 1`) {
  pkCols.set(row.table_name, row.cols);
}

/** Sampled source values keyed by PK, so phase 2 needs no further Postgres access. */
const numericSamples = [];
for (const { table_name: t, column_name: c, numeric_scale: scale } of numericCols) {
  const pk = pkCols.get(t);
  if (!pk) {
    numericSamples.push({ table: t, column: c, scale, pk: null, rows: [] });
    continue;
  }
  const keyExpr = sql.unsafe(pk.map((k) => `"${k}"::text`).join(` || '|' || `));
  const rows = await sql`
    select ${keyExpr} as k, ${sql(c)} as v from ${sql(t)}
    where ${sql(c)} is not null
    order by ${sql(pk[0])} limit ${SAMPLE_SIZE}`;
  numericSamples.push({ table: t, column: c, scale, pk, rows });
}

const jsonCols = (
  await sql`
    select table_name, column_name from information_schema.columns
    where table_schema='public' and data_type in ('jsonb','json')
    order by 1,2`
).filter((c) => isRealTable.has(c.table_name));

await sql.end();

// ===========================================================================
// Phase 2 — D1 only. No Postgres connection is held open past this point.
// ===========================================================================

let failures = 0;

// --- 1. row counts -----------------------------------------------------------
// Scalar subselects rather than UNION ALL — see the note on d1(). Chunked so no single
// command exceeds the argv limit with 51 table names.
const d1Counts = {};
for (let i = 0; i < tables.length; i += 20) {
  const chunk = tables.slice(i, i + 20);
  const query =
    "SELECT " + chunk.map((t) => `(SELECT count(*) FROM "${t}") AS "${t}"`).join(", ");
  const row = d1(query)[0];
  for (const t of chunk) d1Counts[t] = Number(row[t]);
}

console.log("Row counts");
for (const t of tables) {
  const [a, b] = [pgCounts[t], d1Counts[t] ?? 0];
  if (a !== b) {
    console.log(`  MISMATCH ${t.padEnd(34)} pg=${a} d1=${b}`);
    failures++;
  }
}
const totalPg = Object.values(pgCounts).reduce((n, v) => n + v, 0);
console.log(
  `  ${tables.length} tables, ${totalPg} rows — ${failures === 0 ? "all match" : failures + " mismatch(es)"}`
);

// --- 2. scaled numerics ------------------------------------------------------
console.log("\nScaled numeric round-trip");
for (const { table: t, column: c, scale, pk, rows: pgRows } of numericSamples) {
  if (pk === null) {
    console.log(`  SKIP     ${t}.${c} — no primary key, cannot pair rows across engines`);
    failures++;
    continue;
  }
  if (pgRows.length === 0) {
    console.log(`  skip     ${t}.${c} (no rows)`);
    continue;
  }

  const factor = 10 ** scale;
  // The same composite key expression as the Postgres side, so the two agree row for row.
  const d1Key = pk.map((k) => `CAST("${k}" AS TEXT)`).join(` || '|' || `);
  const keys = pgRows.map((r) => `'${String(r.k).replace(/'/g, "''")}'`).join(",");
  const d1ByKey = Object.fromEntries(
    d1(
      `SELECT ${d1Key} AS k, "${c}" AS v FROM "${t}" WHERE ${d1Key} IN (${keys})`
    ).map((r) => [r.k, r.v])
  );

  let bad = 0;
  for (const row of pgRows) {
    const scaled = d1ByKey[row.k];
    if (scaled === undefined || Number(scaled) / factor !== Number(row.v)) {
      if (bad === 0) {
        console.log(
          `  MISMATCH ${t}.${c}  ${pk.join("+")}=${row.k} pg=${row.v} ` +
            `d1=${scaled} (/${factor}=${Number(scaled) / factor})`
        );
      }
      bad++;
    }
  }
  if (bad) failures++;
  else console.log(`  ok       ${t}.${c}  ${pgRows.length} value(s) at scale ${scale}`);
}

// --- 3. JSON columns ---------------------------------------------------------
console.log("\nJSON columns parse");
let jsonChecked = 0;
for (const { table_name: t, column_name: c } of jsonCols) {
  if ((pgCounts[t] ?? 0) === 0) continue;
  const rows = d1(`SELECT "${c}" AS v FROM "${t}" WHERE "${c}" IS NOT NULL LIMIT 5`);
  for (const r of rows) {
    try {
      JSON.parse(r.v);
    } catch {
      console.log(`  MISMATCH ${t}.${c} is not valid JSON: ${String(r.v).slice(0, 60)}`);
      failures++;
    }
  }
  if (rows.length) jsonChecked++;
}
console.log(`  ${jsonChecked} populated JSON column(s) checked`);

console.log(failures === 0 ? "\nD1 PARITY CONFIRMED" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
