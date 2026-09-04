import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * Rollout gate for the Supabase → Drizzle query migration.
 *
 * Converting ~350 query sites in one step is not verifiable. This lets each converted query
 * run in production alongside the original, comparing results on live data, before anything
 * depends on it.
 *
 * Set by `DRIZZLE_MODE`:
 *
 *   - `off` (default) — legacy only. The Drizzle path is not executed at all.
 *   - `shadow` — run both, **return the legacy result**, and log any mismatch. This is the
 *     evidence-gathering mode: real traffic, real data, zero blast radius.
 *   - `on` — Drizzle only. Flip a query here only after shadow mode has been clean for it.
 *
 * Reads only. Writes never get shadow mode: running a mutation twice is not a comparison,
 * it is a duplicate. Convert writes directly, one table at a time, after the matching read
 * has been on `on` for several days.
 *
 * This whole module is scaffolding. Delete it once every caller is on `on`.
 */
export type DrizzleMode = "off" | "shadow" | "on";

export function drizzleMode(): DrizzleMode {
  const mode = process.env.DRIZZLE_MODE;
  return mode === "shadow" || mode === "on" ? mode : "off";
}

/**
 * Compares two results structurally, ignoring key order and row order.
 *
 * Row order is normalised deliberately: ordering is a separate concern, asserted per query
 * by `scripts/migration/verify-drizzle-parity.mjs`, which compares ordered output against
 * production. Folding both into one boolean here would make a mismatch ambiguous.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonical)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])])
    );
  }
  return value;
}

function equivalent(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Runs a read through the configured mode.
 *
 * @param name identifies the query in mismatch logs — use the helper's name.
 * @param legacy the existing Supabase implementation.
 * @param drizzle the Drizzle implementation.
 */
export async function dualRead<T>(
  name: string,
  legacy: () => Promise<T>,
  drizzle: () => Promise<T>
): Promise<T> {
  const mode = drizzleMode();

  if (mode === "off") return legacy();
  if (mode === "on") return drizzle();

  // shadow: the legacy result is authoritative; the Drizzle path must never affect the
  // response, including when it throws.
  const legacyResult = await legacy();

  try {
    const drizzleResult = await drizzle();
    if (!equivalent(legacyResult, drizzleResult)) {
      loggerService.warn("Drizzle shadow read mismatch", {
        category: LogCategory.DATABASE,
        action: "drizzle_shadow_mismatch",
        metadata: {
          query: name,
          // Sizes rather than contents: these rows are user data and must not reach logs.
          legacySize: JSON.stringify(legacyResult)?.length ?? 0,
          drizzleSize: JSON.stringify(drizzleResult)?.length ?? 0,
        },
      });
    }
  } catch (error) {
    loggerService.warn("Drizzle shadow read failed", {
      category: LogCategory.DATABASE,
      action: "drizzle_shadow_error",
      metadata: {
        query: name,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return legacyResult;
}
