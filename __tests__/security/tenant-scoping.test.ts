/**
 * Guards against cross-tenant data exposure as Row Level Security is removed.
 *
 * ## The risk this exists for
 *
 * 149 files query through the cookie-bound Supabase client, and RLS silently filters every
 * one of them to the signed-in user. A Drizzle connection is an ordinary Postgres role with
 * no policies, so that filtering disappears the moment a query is ported.
 *
 * The failure mode is why this is the highest-severity item in the migration: a missing
 * ownership predicate does not throw and does not return empty. It returns **another
 * tenant's rows**, and looks like a working feature.
 *
 * ## What is asserted
 *
 * `scripts/ci/scan-tenant-scoping.mjs` classifies every query against a user-owned table by
 * how it is protected. This test fails if the set of *unprotected* queries grows beyond the
 * baseline below.
 *
 * ## About the baseline
 *
 * The four entries are `findById(id)` methods that fetch a user-owned row by primary key
 * with no ownership predicate. They are **not** a live vulnerability: RLS filters them
 * today, and every current caller additionally re-checks ownership in app code (see
 * `app/api/applications/[id]/route.ts:42` and `app/api/resume/[id]/route.ts:79`).
 *
 * They are a latent hazard rather than a bug — the API invites misuse, because nothing about
 * `findById(id)` signals that the caller is responsible for the ownership check. When RLS is
 * removed, a single new call site that forgets becomes an IDOR.
 *
 * The fix is structural and belongs with the Drizzle port: take a `UserScope`
 * (`lib/db/scope.ts`) rather than a bare string, so an unscoped read cannot be written. Do
 * not simply delete entries from this baseline — shrink it by fixing the methods.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires -- CJS so the CLI and this
// guard share one implementation; see the scanner header.
const { scan } = require("../../scripts/ci/scan-tenant-scoping.js");

/**
 * Known-unprotected reads, accepted for now because RLS plus an app-layer check covers
 * each one. Every entry must disappear before RLS is dropped.
 */
const BASELINE_UNPROTECTED = [
  "dal/ai-coach/index.ts:122",
  "dal/applications/index.ts:144",
  "dal/resumes/index.ts:32",
  "dal/subscriptions/index.ts:73",
].sort();

describe("tenant scoping", () => {
  const buckets = scan();

  it("introduces no new unprotected reads of user-owned tables", () => {
    const found = buckets.unprotected
      .map((v: { file: string; line: number }) => `${v.file}:${v.line}`)
      .sort();

    const added = found.filter((f: string) => !BASELINE_UNPROTECTED.includes(f));

    expect(added).toEqual([]);
  });

  it("reports the baseline shrinking so it can be tightened", () => {
    const found = buckets.unprotected.map(
      (v: { file: string; line: number }) => `${v.file}:${v.line}`
    );
    const fixed = BASELINE_UNPROTECTED.filter((b) => !found.includes(b));

    // Not a failure — a prompt. If entries were fixed, remove them from the baseline so the
    // guard tightens rather than silently permitting a regression back to the old count.
    if (fixed.length > 0) {
      console.warn(
        `[tenant-scoping] ${fixed.length} baseline entr(ies) no longer unprotected. ` +
          `Remove from BASELINE_UNPROTECTED: ${fixed.join(", ")}`
      );
    }
    expect(fixed.length).toBeGreaterThanOrEqual(0);
  });

  it("keeps deliberately public reads explicitly justified", () => {
    // Every allowlisted read must carry a reason, so exemptions cannot accumulate silently.
    for (const entry of buckets.allowlisted) {
      expect(entry.reason).toBeTruthy();
      expect(entry.reason.length).toBeGreaterThan(40);
    }
  });

  it("finds queries to classify at all (guards against the scanner silently breaking)", () => {
    // A scanner that matches nothing would pass every other assertion vacuously.
    const total =
      buckets.unprotected.length +
      buckets.scopedByParent.length +
      buckets.ownedByPayload.length +
      buckets.rlsBypassing.length +
      buckets.allowlisted.length;

    expect(total).toBeGreaterThan(50);
  });
});
