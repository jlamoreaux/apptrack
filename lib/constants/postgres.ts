/**
 * Error codes returned by Postgres (SQLSTATE) and PostgREST that callers branch on.
 */

/** SQLSTATE unique_violation. */
export const UNIQUE_VIOLATION_CODE = "23505";

/** SQLSTATE raise_exception: the default code of a plpgsql RAISE EXCEPTION. */
export const RAISE_EXCEPTION_CODE = "P0001";

/** PostgREST: `.single()` matched no rows. */
export const NO_ROWS_CODE = "PGRST116";
