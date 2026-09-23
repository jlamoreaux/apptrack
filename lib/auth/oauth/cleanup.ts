/**
 * The daily OAuth cleanup: delete_expired_agent_oauth_rows (migration 045)
 * revokes idle grants and deletes unused clients and expired codes and tokens.
 * Never throws.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunctionError, isPlainObject } from "@/lib/careerotter/domain-result";
import { AGENT_OAUTH_RPC } from "@/lib/constants/agent-oauth";
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

function isCleanupResult(value: unknown): value is AgentOAuthCleanupResult {
  return (
    isPlainObject(value) &&
    CLEANUP_COUNT_FIELDS.every((field) => Number.isInteger(value[field]))
  );
}

function logFailure(error: unknown): AgentOAuthCleanupRun {
  loggerService.error("OAuth cleanup failed", error, {
    category: LogCategory.DATABASE,
    action: "mcp_oauth_cleanup_failed",
  });
  return { kind: "failed" };
}

/**
 * Run the cleanup function. `missing_function` means migration 045 hasn't run
 * yet, which is expected before OAuth launches.
 */
export async function deleteExpiredOAuthRows(admin: SupabaseClient): Promise<AgentOAuthCleanupRun> {
  try {
    const { data, error } = await admin.rpc(AGENT_OAUTH_RPC.deleteExpiredRows).single();
    if (isMissingFunctionError(error)) return { kind: "missing_function" };
    if (error) return logFailure(error);
    if (!isCleanupResult(data)) return logFailure("Unexpected delete_expired_agent_oauth_rows result");
    return { kind: "ok", counts: data };
  } catch (error) {
    return logFailure(error);
  }
}
