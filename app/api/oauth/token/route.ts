/**
 * OAuth 2.1 token endpoint (§4.1.3, §4.3) for the MCP server.
 *
 * POST /api/oauth/token -> 200 { access_token, token_type, expires_in,
 *                          refresh_token?, scope } for the authorization_code
 *                          and refresh_token grants; RFC 6749 §5.2 errors
 * OPTIONS               -> CORS preflight
 *
 * 404 unless isMcpOAuthEnabled(). The body is form-encoded, at most 16 KB.
 * Every response carries CORS and no-store. Client authentication and its
 * rate limits live in lib/auth/oauth/token-endpoint.ts; the grants in
 * lib/auth/oauth/tokens.ts. Tokens are never logged.
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { oauthJson, oauthNotFound, oauthPreflight } from "@/lib/auth/oauth/http";
import {
  authenticateEndpointClient,
  formParam,
  readTokenEndpointForm,
  TOKEN_ENDPOINT_HEADERS,
  tokenEndpointUnavailable,
  tokenErrorResponse,
} from "@/lib/auth/oauth/token-endpoint";
import { exchangeAuthorizationCode, refreshTokens } from "@/lib/auth/oauth/tokens";
import { trackAfterResponse } from "@/lib/careerotter/domain-result";
import {
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_TOKEN_PARAMS,
  AGENT_OAUTH_TOKEN_TYPE,
  isMcpOAuthEnabled,
  type AgentOAuthGrantType,
} from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type {
  AgentOAuthClientRecord,
  AgentOAuthCodeExchangeTokens,
  AgentOAuthIssuedTokens,
  AgentOAuthTokenGrantResult,
} from "@/types";

export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createAdminClient>;

const SCOPE_SEPARATOR = " ";

const MESSAGES = {
  grantTypeRequired: "grant_type is required",
  unsupportedGrantType: "grant_type must be authorization_code or refresh_token",
  missingParam: "Missing required parameter",
} as const;

export async function POST(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  const form = await readTokenEndpointForm(request);
  if (!form.ok) return form.response;
  const admin = createAdminClient();
  const client = await authenticateEndpointClient(admin, request.headers, form.value, "token");
  if (!client.ok) return client.response;
  return grantResponse(admin, client.value, form.value);
}

export async function OPTIONS(): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  return oauthPreflight(AGENT_OAUTH_ENDPOINT_CORS_HEADERS);
}

// ── grants ─────────────────────────────────────────────────────────────────

async function grantResponse(
  admin: AdminClient,
  client: AgentOAuthClientRecord,
  form: URLSearchParams
): Promise<Response> {
  const grantType = formParam(form, AGENT_OAUTH_TOKEN_PARAMS.grantType);
  switch (grantType) {
    case "authorization_code":
      return authorizationCodeGrant(admin, client, form);
    case "refresh_token":
      return refreshTokenGrant(admin, client, form);
    case null:
      return tokenErrorResponse("invalid_request", MESSAGES.grantTypeRequired);
    default:
      return tokenErrorResponse("unsupported_grant_type", MESSAGES.unsupportedGrantType);
  }
}

function missingParamResponse(name: string): Response {
  return tokenErrorResponse("invalid_request", `${MESSAGES.missingParam}: ${name}`);
}

async function authorizationCodeGrant(
  admin: AdminClient,
  client: AgentOAuthClientRecord,
  form: URLSearchParams
): Promise<Response> {
  const names = AGENT_OAUTH_TOKEN_PARAMS;
  const code = formParam(form, names.code);
  if (code === null) return missingParamResponse(names.code);
  const codeVerifier = formParam(form, names.codeVerifier);
  if (codeVerifier === null) return missingParamResponse(names.codeVerifier);
  const redirectUri = formParam(form, names.redirectUri);
  if (redirectUri === null) return missingParamResponse(names.redirectUri);

  const resource = formParam(form, names.resource);
  const result = await exchangeAuthorizationCode(admin, client, { code, codeVerifier, redirectUri, resource });
  if (result.ok) trackConnected(result.tokens);
  return grantResultResponse(result, client, "authorization_code");
}

async function refreshTokenGrant(
  admin: AdminClient,
  client: AgentOAuthClientRecord,
  form: URLSearchParams
): Promise<Response> {
  const names = AGENT_OAUTH_TOKEN_PARAMS;
  const refreshToken = formParam(form, names.refreshToken);
  if (refreshToken === null) return missingParamResponse(names.refreshToken);
  const result = await refreshTokens(admin, client, {
    refreshToken,
    resource: formParam(form, names.resource),
    scope: formParam(form, names.scope),
  });
  return grantResultResponse(result, client, "refresh_token");
}

// ── responses ──────────────────────────────────────────────────────────────

/** RFC 6749 §5.1; refresh_token only when one was issued. */
function successBody(tokens: AgentOAuthIssuedTokens): Record<string, unknown> {
  return {
    access_token: tokens.accessToken,
    token_type: AGENT_OAUTH_TOKEN_TYPE,
    expires_in: tokens.expiresIn,
    ...(tokens.refreshToken === null ? {} : { refresh_token: tokens.refreshToken }),
    scope: tokens.scopes.join(SCOPE_SEPARATOR),
  };
}

function grantResultResponse<T extends AgentOAuthIssuedTokens>(
  result: AgentOAuthTokenGrantResult<T>,
  client: AgentOAuthClientRecord,
  grantType: AgentOAuthGrantType
): Response {
  if (result.ok) return oauthJson(successBody(result.tokens), HTTP_STATUS.OK, TOKEN_ENDPOINT_HEADERS);
  if (result.kind === "unavailable") return tokenEndpointUnavailable();
  loggerService.warn("OAuth token request rejected", {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_token_rejected",
    metadata: { grantType, reason: result.reason, error: result.error, clientId: client.client_id },
  });
  return tokenErrorResponse(result.error, result.description);
}

// captureServerEvent never rejects, and trackAfterResponse logs a failure to
// schedule. Sent for a code exchange only: a refresh isn't a new connection.
function trackConnected(tokens: AgentOAuthCodeExchangeTokens): void {
  const event = CAREEROTTER_EVENT_NAMES.MCP_OAUTH_CONNECTED;
  trackAfterResponse({ action: event, userId: tokens.userId }, () =>
    captureServerEvent(tokens.userId, event, {
      scopes: tokens.scopes,
      client_name: tokens.clientName,
    })
  );
}
