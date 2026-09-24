/**
 * Connected apps: revoke one.
 *
 * DELETE /api/careerotter/agent-grants/:id -> { success: true }
 *
 * 404 unless isMcpOAuthEnabled(). Session cookie only (never extension JWTs,
 * personal access tokens or OAuth access tokens). Idempotent: revoking an
 * already revoked grant succeeds. A missing, foreign or non-uuid id is a 404,
 * so another user's grant can't be told apart from one that doesn't exist.
 */

import { type NextRequest, NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { revokeAgentGrant } from "@/lib/auth/oauth/grants";
import { oauthNotFound } from "@/lib/auth/oauth/http";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session-user";
import { trackAfterResponse } from "@/lib/careerotter/domain-result";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";
import {
  AGENT_OAUTH_USER_REVOKE_REASON,
  isMcpOAuthEnabled,
} from "@/lib/constants/agent-oauth";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// captureServerEvent never rejects, and trackAfterResponse logs a failure to
// schedule, so analytics can't change the response.
function trackRevoked(userId: string, grantId: string): void {
  const event = CAREEROTTER_EVENT_NAMES.MCP_OAUTH_REVOKED;
  loggerService.info("OAuth grant revoked by its user", {
    category: LogCategory.SECURITY,
    userId,
    action: event,
    metadata: { reason: AGENT_OAUTH_USER_REVOKE_REASON, grantId },
  });
  trackAfterResponse({ action: event, userId }, () =>
    captureServerEvent(userId, event, { reason: AGENT_OAUTH_USER_REVOKE_REASON })
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedResponse();

  const revoked = await revokeAgentGrant(createAdminClient(), userId, id);
  if (!revoked.ok) return domainErrorResponse(revoked);
  if (revoked.value.revoked) trackRevoked(userId, revoked.value.grantId);

  return NextResponse.json({ success: true });
}
