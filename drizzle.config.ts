import type { Config } from "drizzle-kit";
import { readFileSync } from "node:fs";

/**
 * Drizzle configuration.
 *
 * The connection URL is read directly from .env / .env.local rather than via dotenv so
 * that this file has no runtime dependency and behaves identically in CI.
 *
 * IMPORTANT: the schema baseline is introspected from PRODUCTION, not reconstructed from
 * the SQL in schemas/ or migrations/. Those directories are frozen and have provably
 * diverged (see db/prod-truth/README.md).
 */
function databaseUrl(): string {
  const fromEnv = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;

  for (const file of [".env", ".env.local"]) {
    try {
      const match = readFileSync(file, "utf8").match(
        /^POSTGRES_URL_NON_POOLING=(.*)$/m
      );
      if (match) return match[1].trim().replace(/^"|"$/g, "");
    } catch {
      // file absent — try the next one
    }
  }
  // `generate` and `check` compare schema.ts against the committed snapshot and never
  // open a connection, so CI can run the drift guard without credentials. Only `pull`
  // and `migrate` need a real URL, and those fail loudly on this placeholder.
  return "postgresql://unset:unset@localhost:5432/unset";
}

export default {
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl() },
  // Only `public` is managed. lib/db/schema/auth.ts declares auth.users and
  // auth.identities so the 32 foreign keys pointing at them resolve, but those
  // tables are owned by Supabase today and must never appear in a generated
  // migration. `schemaFilter` governs introspection; `entities.roles` and this
  // filter together keep generate from emitting CREATE SCHEMA "auth".
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
} satisfies Config;
