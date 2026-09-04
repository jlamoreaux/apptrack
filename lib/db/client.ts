import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle client.
 *
 * ## Status
 *
 * Introduced for the Supabase → Drizzle migration. Nothing routes through it in production
 * yet: `lib/db/dual-read.ts` gates every converted query behind `DRIZZLE_MODE`, which
 * defaults to `off`. Setting that variable is what actually exercises this connection.
 *
 * ## Driver choice
 *
 * `postgres-js` against Supabase's pooler. Two constraints drove it:
 *
 *   - `drizzle-orm/neon-http` **cannot run multi-statement transactions**, which the trigger
 *     drain in Stage 6 depends on, and it spends one HTTP subrequest per query against the
 *     Workers 1000-subrequest budget.
 *   - `prepare: false` is required. The pooled URL (port 6543) is pgbouncer in transaction
 *     mode, which does not support prepared statements.
 *
 * ## This is temporary
 *
 * The destination is D1, so this driver leaves with the `pg-core` schema at cutover. It
 * exists because the app runs on Supabase Postgres today and the query migration has to
 * happen somewhere. Avoid Postgres-only Drizzle constructs in code written against it —
 * jsonb operators, array columns, `FOR UPDATE` — since those must be rewritten for SQLite.
 */

/**
 * Renders a Postgres date/timestamp exactly as PostgREST does.
 *
 * Postgres hands the driver its native text form; PostgREST re-renders it as ISO 8601
 * before serialising to JSON. Two differences, both purely textual — the instant and the
 * precision are identical:
 *
 *   Postgres    2025-06-04 22:33:26.314059+00
 *   PostgREST   2025-06-04T22:33:26.314059+00:00
 *
 * Plain dates (OID 1082) have no time component and pass through untouched, which is what
 * keeps `date_applied` as "2025-06-01" rather than a full timestamp.
 *
 * Letting postgres-js parse to a JS `Date` instead would lose microseconds and change the
 * shape of every API response — including the ones the browser extension consumes.
 */
function toPostgrestTimestamp(value: string): string {
  // A bare date has no space separator; nothing to normalise.
  if (!value.includes(" ")) return value;

  const isoSeparated = value.replace(" ", "T");
  // Postgres abbreviates a whole-hour offset ("+00"); PostgREST always writes "+00:00".
  return isoSeparated.replace(/([+-])(\d{2})$/, "$1$2:00");
}

/** Reused across invocations so a warm Lambda or isolate does not reconnect per request. */
let connection: ReturnType<typeof postgres> | undefined;

function connectionString(): string {
  // The pooled URL is correct for request-path queries; the non-pooling one (port 5432) is
  // reserved for migrations and dumps, which need session-level features.
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "POSTGRES_URL is not set. The Drizzle client cannot connect; if you did not intend to use it, check that DRIZZLE_MODE is unset or 'off'."
    );
  }
  return url;
}

export function getDb() {
  if (!connection) {
    connection = postgres(connectionString(), {
      // pgbouncer in transaction mode rejects prepared statements.
      prepare: false,
      // Serverless invocations are short-lived and numerous; a large pool per instance
      // exhausts the pooler's connection budget rather than helping.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      types: {
        /**
         * Return date and timestamp columns as the raw Postgres strings, matching PostgREST.
         *
         * This is not cosmetic. postgres-js parses these into JS `Date` objects by default,
         * and a parity run against production showed two consequences:
         *
         *   - `date_applied` became "2025-06-01T00:00:00.000Z" instead of "2025-06-01",
         *     which breaks any consumer treating it as a plain date.
         *   - `changed_at` lost microseconds: "…552138+00:00" became "…552Z".
         *
         * Both would have shipped silently — the values still look like timestamps. Since
         * the API responses feed the browser extension and client code compares these as
         * strings, the driver must hand back exactly what PostgREST did.
         *
         * OIDs: 1082 date, 1114 timestamp, 1184 timestamptz.
         */
        date: {
          to: 1184,
          from: [1082, 1114, 1184],
          serialize: (value: string) => value,
          parse: toPostgrestTimestamp,
        },
      },
    });
  }
  return drizzle(connection, { schema });
}

/**
 * Closes the pool. For scripts and tests — a request handler should never call this, since
 * the connection is deliberately shared across invocations.
 */
export async function closeDb(): Promise<void> {
  if (connection) {
    await connection.end({ timeout: 5 });
    connection = undefined;
  }
}
