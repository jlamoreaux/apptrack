/**
 * Drizzle schema — introspected from PRODUCTION, not reconstructed from the SQL in
 * schemas/ or migrations/ (both frozen; see db/prod-truth/README.md for why).
 *
 * Regenerate with:  pnpm db:pull
 * Verify coverage:  pnpm db:verify
 *
 * Physical names stay snake_case on purpose. Every one of the ~148 files that query the
 * database, every API JSON response, and every test fixture uses `user_id`, `file_url`,
 * `date_applied`. Mapping to camelCase would turn a mechanical migration into a semantic
 * one with a serialization-boundary bug in every route.
 */
export * from "./auth";
export * from "./schema";
export * from "./relations";
