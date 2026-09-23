/**
 * Daily OAuth cleanup cron for the MCP server's authorization server.
 *
 * Calls delete_expired_agent_oauth_rows (migration 045), which revokes grants
 * idle for 30 days and deletes clients that never authorized, and codes and
 * tokens past their retention. Gated on CAREEROTTER_ENABLED only, not the
 * OAuth flag, so rows keep getting cleaned up while OAuth is switched off.
 * Before 045 has run the function doesn't exist, and the run is a no-op.
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteExpiredOAuthRows } from "@/lib/auth/oauth/cleanup";
import { oauthNotFound } from "@/lib/auth/oauth/http";
import { AGENT_OAUTH_PATHS, isCareerotterEnabled } from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const MIGRATION_NOT_APPLIED = "delete_expired_agent_oauth_rows doesn't exist; migration 045 hasn't run";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isCareerotterEnabled()) return oauthNotFound();
  if (!verifyCronAuth(request, AGENT_OAUTH_PATHS.cleanupCron)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_STATUS.UNAUTHORIZED });
  }

  const run = await deleteExpiredOAuthRows(createAdminClient());
  switch (run.kind) {
    case "missing_function":
      loggerService.info("OAuth cleanup skipped", {
        category: LogCategory.BUSINESS,
        action: "mcp_oauth_cleanup_skipped",
        metadata: { note: MIGRATION_NOT_APPLIED },
      });
      return NextResponse.json({ skipped: MIGRATION_NOT_APPLIED });
    case "failed":
      return NextResponse.json(
        { error: "cleanup failed" },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    case "ok":
      loggerService.info("OAuth cleanup complete", {
        category: LogCategory.BUSINESS,
        action: "mcp_oauth_cleanup_complete",
        metadata: { ...run.counts },
      });
      if (run.counts.idle_grants_revoked > 0) {
        loggerService.info("OAuth grants revoked as idle", {
          category: LogCategory.SECURITY,
          action: "mcp_oauth_idle_grants_revoked",
          metadata: { count: run.counts.idle_grants_revoked },
        });
      }
      return NextResponse.json(run.counts);
  }
}
