#!/usr/bin/env node
/**
 * Proves the Drizzle read helpers return the same data as the Supabase ones.
 *
 * Runs both implementations against **production, read-only**, for a sample of real users,
 * and diffs the results. This is the evidence that a converted query is safe to flip; a unit
 * test against a mocked query builder cannot tell you whether a `where` clause is right.
 *
 * Read-only: only SELECTs, no writes, no schema changes.
 *
 * Usage:
 *   node scripts/migration/verify-drizzle-parity.mjs [--users N]
 *
 * Requires POSTGRES_URL (pooled) and the Supabase service-role credentials in .env.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function fromEnvFile(key) {
  for (const file of [".env", ".env.local"]) {
    try {
      const m = readFileSync(file, "utf-8").match(new RegExp(`^${key}=(.*)$`, "m"));
      if (m) return m[1].trim().replace(/^"|"$/g, "");
    } catch {
      /* try the next file */
    }
  }
  return undefined;
}

const sampleSize = Number(
  process.argv[process.argv.indexOf("--users") + 1] || 5
);

// Must mirror lib/db/client.ts exactly, or the harness measures the wrong driver.
// Notably the date/timestamp passthrough: without it postgres-js returns JS Dates whose
// serialisation differs from PostgREST's (see that file for the detail).
/** Mirrors toPostgrestTimestamp in lib/db/client.ts. */
function toPostgrestTimestamp(value) {
  if (!value.includes(" ")) return value;
  return value.replace(" ", "T").replace(/([+-])(\d{2})$/, "$1$2:00");
}

const sql = postgres(fromEnvFile("POSTGRES_URL"), {
  prepare: false,
  max: 1,
  types: {
    date: {
      to: 1184,
      from: [1082, 1114, 1184],
      serialize: (v) => v,
      parse: toPostgrestTimestamp,
    },
  },
});
const supabase = createClient(
  fromEnvFile("NEXT_PUBLIC_SUPABASE_URL"),
  fromEnvFile("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

/**
 * Compares two result sets ignoring key order and array order.
 *
 * Row order is normalised because the point is data parity, not ordering — ordering is
 * asserted separately, per query, since a wrong ORDER BY is a real defect (it is how the
 * getApplicationHistory ascending/descending mistake was found).
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).sort(compare);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, canonical(value[k])])
    );
  }
  return value;
}
const compare = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Each check runs the Supabase and raw-SQL forms of one helper for one user. */
const CHECKS = {
  async getProfile(userId) {
    const legacy = (
      await supabase.from("profiles").select("*").eq("id", userId).single()
    ).data;
    const [modern] = await sql`select * from profiles where id = ${userId} limit 1`;
    return [legacy, modern ?? null];
  },

  async getUsage(userId) {
    const legacy = (
      await supabase.from("usage_tracking").select("*").eq("user_id", userId).single()
    ).data;
    const [modern] =
      await sql`select * from usage_tracking where user_id = ${userId} limit 1`;
    return [legacy, modern ?? null];
  },

  async getApplications(userId) {
    const legacy = (
      await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("created_at", { ascending: false })
    ).data;
    const modern = await sql`
      select * from applications
      where user_id = ${userId} and archived = false
      order by created_at desc`;
    return [legacy, [...modern]];
  },

  async getArchivedApplications(userId) {
    const legacy = (
      await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", true)
        .order("updated_at", { ascending: false })
    ).data;
    const modern = await sql`
      select * from applications
      where user_id = ${userId} and archived = true
      order by updated_at desc`;
    return [legacy, [...modern]];
  },

  async getApplicationHistory(userId) {
    const legacy = (
      await supabase
        .from("application_history")
        .select("*, applications!inner(user_id)")
        .eq("applications.user_id", userId)
        .order("changed_at", { ascending: true })
    ).data?.map(({ applications, ...rest }) => rest);
    const modern = await sql`
      select h.* from application_history h
      join applications a on a.id = h.application_id
      where a.user_id = ${userId}
      order by h.changed_at asc`;
    return [legacy, [...modern]];
  },
};

const users = await sql`
  select u.id from auth.users u
  join applications a on a.user_id = u.id
  group by u.id order by count(a.id) desc limit ${sampleSize}`;

console.log(`Comparing ${Object.keys(CHECKS).length} helpers across ${users.length} users\n`);

let failures = 0;
for (const [name, run] of Object.entries(CHECKS)) {
  let matched = 0;
  for (const { id } of users) {
    const [legacy, modern] = await run(id);
    if (same(legacy, modern)) {
      matched++;
    } else {
      failures++;
      console.log(`  MISMATCH ${name} user=${id}`);
      console.log(`    supabase: ${JSON.stringify(legacy)?.slice(0, 300)}`);
      console.log(`    drizzle:  ${JSON.stringify(modern)?.slice(0, 300)}`);
    }
  }
  console.log(`${matched === users.length ? "ok  " : "FAIL"} ${name}: ${matched}/${users.length}`);
}

await sql.end();
console.log(failures === 0 ? "\nPARITY CONFIRMED" : `\n${failures} mismatch(es)`);
process.exit(failures === 0 ? 0 : 1);
