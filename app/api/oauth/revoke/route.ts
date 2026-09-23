/**
 * OAuth 2.0 token revocation (RFC 7009) for the MCP server.
 *
 * POST /api/oauth/revoke -> 200 with an empty body, whether or not the token
 *                           was known (RFC 7009 §2.2); 401 only when client
 *                           authentication fails
 * OPTIONS                -> CORS preflight
 *
 * 404 unless isMcpOAuthEnabled(). Form-encoded, with the token endpoint's
 * client authentication and rate limits. An access or refresh token that
 * belongs to the authenticated client revokes its whole grant (reason
 * `client`); token_type_hint is ignored. Tokens are never logged.
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { formParam, oauthNotFound, oauthPreflight } from "@/lib/auth/oauth/http";
import {
  authenticateEndpointClient,
  readTokenEndpointForm,
  TOKEN_ENDPOINT_HEADERS,
  tokenEndpointUnavailable,
  tokenErrorResponse,
} from "@/lib/auth/oauth/token-endpoint";
import { revokeClientToken } from "@/lib/auth/oauth/tokens";
import { trackAfterResponse } from "@/lib/careerotter/domain-result";
import {
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_TOKEN_PARAMS,
  isMcpOAuthEnabled,
  type AgentOAuthRevokeReason,
} from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const runtime = "nodejs";

const CLIENT_REVOKE_REASON = "client" satisfies AgentOAuthRevokeReason;
const MISSING_TOKEN = "Missing required parameter: token";

export async function POST(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  const form = await readTokenEndpointForm(request);
  if (!form.ok) return form.response;
  const admin = createAdminClient();
  const client = await authenticateEndpointClient(admin, request.headers, form.value, "revoke");
  if (!client.ok) return client.response;

  const token = formParam(form.value, AGENT_OAUTH_TOKEN_PARAMS.token);
  if (token === null) return tokenErrorResponse("invalid_request", MISSING_TOKEN);
  const clientId = client.value.client_id;
  const revocation = await revokeClientToken(admin, clientId, token);
  if (!revocation.ok) return tokenEndpointUnavailable();
  if (revocation.outcome === "revoked") trackRevoked(clientId, revocation.grantId);
  return new Response(null, { status: HTTP_STATUS.OK, headers: TOKEN_ENDPOINT_HEADERS });
}

export async function OPTIONS(): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  return oauthPreflight(AGENT_OAUTH_ENDPOINT_CORS_HEADERS);
}

// The revocation result carries no user, so the client id is the distinct
// id, without a person profile, as for registration. captureServerEvent never
// rejects, and trackAfterResponse logs a failure to schedule.
function trackRevoked(clientId: string, grantId: string | null): void {
  const event = CAREEROTTER_EVENT_NAMES.MCP_OAUTH_REVOKED;
  loggerService.info("OAuth grant revoked by its client", {
    category: LogCategory.SECURITY,
    action: event,
    metadata: { reason: CLIENT_REVOKE_REASON, grantId, clientId },
  });
  trackAfterResponse({ action: event }, () =>
    captureServerEvent(clientId, event, {
      reason: CLIENT_REVOKE_REASON,
      $process_person_profile: false,
    })
  );
}
