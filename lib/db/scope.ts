/**
 * Tenant scoping.
 *
 * ## Why this exists
 *
 * Today, 149 files query Postgres through the cookie-bound Supabase client, and Row Level
 * Security silently filters every one of them to the signed-in user. A Drizzle connection
 * is an ordinary Postgres role with no policies attached, so the moment a query moves to
 * Drizzle that backstop disappears.
 *
 * The failure mode is what makes this the highest-severity item in the migration: a missing
 * ownership predicate does not throw and does not return empty. It returns **another
 * tenant's rows**, and looks like a working feature.
 *
 * ## The mitigation
 *
 * `UserScope` is a branded type. It cannot be constructed from a bare string, so a
 * repository method that takes a `UserScope` cannot be called without a verified identity —
 * "I forgot to pass the user id" becomes a compile error rather than a data leak.
 *
 * This is one of three layers, and on its own it is not sufficient:
 *
 *   1. This type, so an unscoped call cannot be written by accident.
 *   2. `__tests__/security/tenant-scoping.test.ts`, which fails the build if a query
 *      against a user-owned table carries no ownership predicate.
 *   3. Per-table isolation tests once queries are on Drizzle: create rows for user A and
 *      user B, call every read as A, assert B's rows never appear. A mocked query builder
 *      cannot tell you whether a `where` clause is correct, so those must run against a
 *      real database.
 */

declare const scopeBrand: unique symbol;

/**
 * A verified user identity, usable as a query filter.
 *
 * Deliberately not constructible from a raw string — see `userScope`.
 */
export type UserScope = {
  readonly userId: string;
  readonly [scopeBrand]: "UserScope";
};

/**
 * Mints a `UserScope` from an authenticated user id.
 *
 * **Only call this immediately after verifying a session** (`auth.getUser()`, a Better Auth
 * session lookup, or the extension-JWT path in `lib/auth/extension-auth.ts`). Calling it on
 * a user id taken from a request body, query string, or route parameter defeats the entire
 * point — that id is attacker-controlled.
 *
 * @throws if the id is empty, which would otherwise produce a scope matching nothing and
 * mask a broken auth path as "no results".
 */
export function userScope(verifiedUserId: string): UserScope {
  if (!verifiedUserId) {
    throw new Error(
      "userScope() requires a non-empty verified user id. An empty scope silently matches no rows and hides a broken auth path."
    );
  }
  return { userId: verifiedUserId } as UserScope;
}

/**
 * Reads the id back out for use in a query predicate.
 *
 * A plain property read would work; this exists so call sites are greppable — searching for
 * `scopedUserId` finds every place a tenant filter is applied.
 */
export function scopedUserId(scope: UserScope): string {
  return scope.userId;
}
