/**
 * The daily OAuth cleanup: delete_expired_agent_oauth_rows (migration 045)
 * revokes idle grants and deletes unused clients and expired codes and tokens,
 * at most AGENT_OAUTH_CLEANUP.batchSize rows per rule per call. A run calls it
 * again while any rule filled its batch (so more may be left), up to
 * AGENT_OAUTH_CLEANUP.maxRounds calls; whatever is left waits for the next
 * run. Never throws.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunctionError, isPlainObject } from "@/lib/careerotter/domain-result";
import { AGENT_OAUTH_CLEANUP, AGENT_OAUTH_RPC } from "@/lib/constants/agent-oauth";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { AgentOAuthCleanupResult, AgentOAuthCleanupRun } from "@/types";

const CLEANUP_COUNT_FIELDS = [
  "idle_grants_revoked",
  "codes_deleted",
  "access_tokens_deleted",
  "refresh_tokens_deleted",
  "clients_deleted",
] as const satisfies readonly (keyof AgentOAuthCleanupResult)[];

type Round =
  | { kind: "ok"; counts: AgentOAuthCleanupResult }
  | { kind: "missing_function" }
  | { kind: "failed" };

function emptyCounts(): AgentOAuthCleanupResult {
  return {
    idle_grants_revoked: 0,
    codes_deleted: 0,
    access_tokens_deleted: 0,
    refresh_tokens_deleted: 0,
    clients_deleted: 0,
  };
}

function isCleanupResult(value: unknown): value is AgentOAuthCleanupResult {
  return (
    isPlainObject(value) &&
    CLEANUP_COUNT_FIELDS.every((field) => Number.isInteger(value[field]))
  );
}

function logRoundFailure(error: unknown, round: number): Round {
  loggerService.error("OAuth cleanup call failed", error, {
    category: LogCategory.DATABASE,
    action: "mcp_oauth_cleanup_failed",
    metadata: { round },
  });
  return { kind: "failed" };
}

async function runRound(admin: SupabaseClient, round: number): Promise<Round> {
  try {
    const { data, error } = await admin.rpc(AGENT_OAUTH_RPC.deleteExpiredRows).single();
    if (isMissingFunctionError(error)) return { kind: "missing_function" };
    if (error) return logRoundFailure(error, round);
    if (!isCleanupResult(data)) {
      return logRoundFailure("Unexpected delete_expired_agent_oauth_rows result", round);
    }
    return { kind: "ok", counts: data };
  } catch (error) {
    return logRoundFailure(error, round);
  }
}

function addCounts(total: AgentOAuthCleanupResult, round: AgentOAuthCleanupResult): void {
  for (const field of CLEANUP_COUNT_FIELDS) total[field] += round[field];
}

/** A rule that filled its batch may have more rows waiting. */
function mayHaveMore(counts: AgentOAuthCleanupResult): boolean {
  return CLEANUP_COUNT_FIELDS.some((field) => counts[field] >= AGENT_OAUTH_CLEANUP.batchSize);
}

/**
 * Run the cleanup until a call leaves nothing behind or the round limit is
 * reached. `missing_function` means migration 045 hasn't run yet, which is
 * expected before OAuth launches.
 */
export async function deleteExpiredOAuthRows(admin: SupabaseClient): Promise<AgentOAuthCleanupRun> {
  const counts = emptyCounts();
  for (let round = 1; round <= AGENT_OAUTH_CLEANUP.maxRounds; round++) {
    const result = await runRound(admin, round);
    if (result.kind === "missing_function") return result;
    if (result.kind === "failed") return { kind: "failed", counts, rounds: round - 1 };
    addCounts(counts, result.counts);
    if (!mayHaveMore(result.counts)) return { kind: "ok", counts, rounds: round, complete: true };
  }
  return { kind: "ok", counts, rounds: AGENT_OAUTH_CLEANUP.maxRounds, complete: false };
}
