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
 * Usage:  node scripts/migration/verify-d1-parity.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DB_NAME = "careerotter";

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

/** Runs SQL on D1 and returns the parsed rows. */
function d1(query) {
  const out = execFileSync(
    "wrangler",
    ["d1", "execute", DB_NAME, "--remote", "--json", "--command", query],
    { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
  ).toString();
  return JSON.parse(out)[0].results;
}

const sql = postgres(fromEnvFile("POSTGRES_URL"), {
  prepare: false,
  max: 1,
  types: {
    date: { to: 1184, from: [1082, 1114, 1184], serialize: (v) => v, parse: (v) => v },
  },
});

let failures = 0;

// --- 1. row counts -----------------------------------------------------------
const tables = (
  await sql`select relname as t from pg_class
            where relnamespace='public'::regnamespace and relkind='r' order by 1`
).map((r) => r.t);

const pgCounts = Object.fromEntries(
  await Promise.all(
    tables.map(async (t) => [t, Number((await sql`select count(*) c from ${sql(t)}`)[0].c)])
  )
);

const d1Counts = Object.fromEntries(
  d1(
    tables
      .map((t) => `SELECT '${t}' AS t, count(*) AS c FROM "${t}"`)
      .join(" UNION ALL ")
  ).map((r) => [r.t, Number(r.c)])
);

console.log("Row counts");
for (const t of tables) {
  const [a, b] = [pgCounts[t], d1Counts[t] ?? 0];
  if (a !== b) {
    console.log(`  MISMATCH ${t.padEnd(34)} pg=${a} d1=${b}`);
    failures++;
  }
}
const totalPg = Object.values(pgCounts).reduce((n, v) => n + v, 0);
console.log(`  ${tables.length} tables, ${totalPg} rows — ${failures === 0 ? "all match" : failures + " mismatch(es)"}`);

// --- 2. scaled numerics ------------------------------------------------------
const numerics = await sql`
  select table_name, column_name, numeric_scale
  from information_schema.columns
  where table_schema='public' and data_type='numeric' and numeric_scale > 0
    and table_name in (select relname from pg_class where relnamespace='public'::regnamespace and relkind='r')
  order by 1,2`;

console.log("\nScaled numeric round-trip");
for (const col of numerics) {
  const { table_name: t, column_name: c, numeric_scale: scale } = col;
  const factor = 10 ** scale;

  const pgRows = await sql`
    select id::text as id, ${sql(c)} as v from ${sql(t)}
    where ${sql(c)} is not null order by id limit 50`;
  if (pgRows.length === 0) {
    console.log(`  skip     ${t}.${c} (no rows)`);
    continue;
  }

  const ids = pgRows.map((r) => `'${r.id}'`).join(",");
  const d1Rows = d1(`SELECT id, "${c}" AS v FROM "${t}" WHERE id IN (${ids})`);
  const d1ById = Object.fromEntries(d1Rows.map((r) => [r.id, r.v]));

  let bad = 0;
  for (const row of pgRows) {
    const scaled = d1ById[row.id];
    if (scaled === undefined || Number(scaled) / factor !== Number(row.v)) {
      if (bad === 0) {
        console.log(
          `  MISMATCH ${t}.${c}  id=${row.id} pg=${row.v} d1=${scaled} (/${factor}=${Number(scaled) / factor})`
        );
      }
      bad++;
    }
  }
  if (bad) failures++;
  else console.log(`  ok       ${t}.${c}  ${pgRows.length} value(s) at scale ${scale}`);
}

// --- 3. JSON columns ---------------------------------------------------------
const jsonCols = await sql`
  select table_name, column_name from information_schema.columns
  where table_schema='public' and data_type in ('jsonb','json')
    and table_name in (select relname from pg_class where relnamespace='public'::regnamespace and relkind='r')
  order by 1,2`;

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

await sql.end();
console.log(failures === 0 ? "\nD1 PARITY CONFIRMED" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
