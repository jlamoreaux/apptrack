#!/usr/bin/env node
/**
 * Finds queries against user-owned tables that carry no ownership predicate.
 *
 * ## Why
 *
 * Row Level Security currently filters every query made through the cookie-bound Supabase
 * client. Moving to Drizzle removes that backstop, and a missing ownership predicate then
 * returns *another tenant's rows* rather than throwing or returning empty. This surfaces
 * that class of bug now, while RLS is still masking it.
 *
 * ## Accuracy
 *
 * A guard nobody trusts is worse than no guard, so results are bucketed by how the query is
 * actually protected rather than lumped into one alarming number:
 *
 *   - `unprotected` — no ownership signal anywhere in the enclosing function. Review these.
 *   - `scopedByParent` — the function verifies ownership of a parent row first, then queries
 *     children by that parent's id (e.g. confirm the application belongs to the user, then
 *     read its analyses by `application_id`). Correct today, but the ownership hop becomes
 *     implicit once RLS is gone, so each needs a decision during the Drizzle migration.
 *   - `ownedByPayload` — an insert/upsert whose payload carries `user_id`. Ownership lives
 *     in the written row, not in a `where`.
 *   - `rlsBypassing` — the file uses the admin or service-role client, which bypasses RLS by
 *     design. Expected, listed for completeness.
 *   - `allowlisted` — deliberately public reads, enumerated below with reasons.
 *
 * Usage:  node scripts/ci/scan-tenant-scoping.js [--json]
 */
const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const ROOT = process.cwd();

/** Tables with a `user_id` column, per db/prod-truth/01_public_schema.sql. */
const USER_OWNED_TABLES = [
  "ai_feature_usage", "ai_preview_sessions", "ai_usage_tracking",
  "ai_user_limit_overrides", "application_linkedin_contacts", "applications",
  "audience_members", "career_advice", "career_goals", "career_profiles",
  "coach_memory", "comp_entries", "conversations", "cover_letters", "drip_emails",
  "email_preferences", "interview_prep", "job_fit_analysis", "linkedin_profiles",
  "promo_code_usage", "resume_analysis", "roasts", "scheduled_notifications",
  "tailored_resumes", "trial_history", "usage_tracking", "user_announcements",
  "user_onboarding", "user_onboarding_preferences", "user_resumes",
  "user_subscriptions", "weekly_recaps", "wins",
];

/**
 * Reads that are public on purpose. Each entry must say why, because every exemption here
 * is a place where a future mistake will not be caught.
 */
const ALLOWLIST = [
  {
    match: (file, table, stmt) =>
      table === "roasts" && /\.eq\(\s*["'`]shareable_id["'`]/.test(stmt),
    reason:
      "Roast sharing is a public feature: a roast is fetched by its unguessable shareable_id " +
      "and rendered to anonymous visitors. schemas/roasts.sql grants SELECT USING (true) to match.",
  },
];

const RLS_BYPASSING_CLIENTS = ["createAdminClient", "createServiceRoleClient"];

/** A `where` on the owning column. */
const OWNERSHIP_PREDICATES = [
  /\.eq\(\s*["'`]user_id["'`]/,
  /\.in\(\s*["'`]user_id["'`]/,
  /\.match\(\s*\{[^}]*user_id/,
  /\.or\([^)]*user_id/,
];

/**
 * Ownership carried in an insert/upsert payload rather than a filter.
 *
 * Matched on the call alone, not on a literal `user_id`: DAL methods pass a typed object
 * (`.insert(data)` where data is CreateApplicationInput), so the column name never appears
 * in the statement text. The type is what guarantees ownership, which a text scan cannot
 * see — hence a separate bucket rather than a pass or a violation.
 */
const PAYLOAD_OWNERSHIP = /\.(insert|upsert)\(/;

/** An ownership check on some row earlier in the same function. */
const PARENT_OWNERSHIP = /\.eq\(\s*["'`]user_id["'`]\s*,|user_id:\s*\w*[Uu]ser/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "drizzle", "db", "scripts"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry) && !full.includes("__tests__")) files.push(full);
  }
  return files;
}

/**
 * Returns the text of the query chain beginning at `.from(`.
 *
 * Reads to the end of the statement rather than a fixed line window: chains here routinely
 * span 20+ lines because of multi-line `select()` strings, and a fixed window produced false
 * positives by truncating before the `.eq()`.
 */
function statementAt(lines, startIndex) {
  const collected = [];
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 60); i++) {
    collected.push(lines[i]);
    const line = lines[i];
    // Terminates on a line that ends the chain: a semicolon not inside a template/string.
    if (/;\s*$/.test(line) && i > startIndex) break;
  }
  return collected.join("\n");
}

function scan() {
  const buckets = {
    unprotected: [],
    scopedByParent: [],
    ownedByPayload: [],
    rlsBypassing: [],
    allowlisted: [],
  };

  for (const file of walk(ROOT)) {
    const source = readFileSync(file, "utf-8");
    if (!source.includes(".from(")) continue;

    const usesBypassingClient = RLS_BYPASSING_CLIENTS.some((c) => source.includes(c));
    const lines = source.split("\n");

    lines.forEach((line, i) => {
      const match = line.match(/\.from\(\s*["'`]([a-z_]+)["'`]/);
      if (!match) return;
      const table = match[1];
      if (!USER_OWNED_TABLES.includes(table)) return;

      const statement = statementAt(lines, i);
      const rel = relative(ROOT, file);
      const entry = { file: rel, line: i + 1, table };

      if (OWNERSHIP_PREDICATES.some((p) => p.test(statement))) return; // properly scoped

      const allow = ALLOWLIST.find((a) => a.match(rel, table, statement));
      if (allow) {
        buckets.allowlisted.push({ ...entry, reason: allow.reason });
        return;
      }
      if (PAYLOAD_OWNERSHIP.test(statement)) {
        buckets.ownedByPayload.push(entry);
        return;
      }
      if (usesBypassingClient) {
        buckets.rlsBypassing.push(entry);
        return;
      }
      // Ownership established earlier in the file (typically a parent-row check).
      if (PARENT_OWNERSHIP.test(lines.slice(0, i).join("\n"))) {
        buckets.scopedByParent.push(entry);
        return;
      }
      buckets.unprotected.push(entry);
    });
  }
  return buckets;
}

module.exports = { scan, USER_OWNED_TABLES };

// CLI entry point. CommonJS rather than ESM so the Jest guard can require this directly;
// import.meta is unavailable once Jest transpiles a module to CJS.
if (require.main === module) {
  const b = scan();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(b, null, 2));
  } else {
    for (const [name, items] of Object.entries(b)) {
      console.log(`\n${name}: ${items.length}`);
      for (const item of items.slice(0, 40)) {
        console.log(`  ${item.file}:${item.line}  ${item.table}`);
      }
      if (items.length > 40) console.log(`  … and ${items.length - 40} more`);
    }
  }
  process.exit(b.unprotected.length > 0 ? 1 : 0);
}
