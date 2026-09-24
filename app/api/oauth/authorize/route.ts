/**
 * The consent decision for the OAuth authorization flow.
 *
 * POST /api/oauth/authorize, from the consent screen only:
 * - 404 unless isMcpOAuthEnabled()
 * - 403 unless the Origin is this origin and the body is JSON (consent CSRF)
 * - 401 without a session cookie; bearer credentials are never consulted
 * - 409 account_changed when the session isn't the user the screen was
 *   rendered for (expectedUserId), e.g. after signing in as someone else in
 *   another tab
 * - the request parameters are revalidated from scratch: 400 when they can't
 *   be returned to the app, 503 when the client lookup fails, and a redirect
 *   error answers with the app's error URL
 * - deny -> { redirectUrl } carrying access_denied, state and iss
 * - approve -> scopes and expiry follow the token rules (400 otherwise), a
 *   single-use code is stored as its digest (409 at the connected-app cap),
 *   and { redirectUrl } carries the code, state and iss
 * The code is never logged.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAccessChoice } from "@/lib/auth/agent-token";
import {
  accessDeniedRedirectUrl,
  authorizationCodeRedirectUrl,
  authorizationErrorRedirectUrl,
  validateAuthorizeRequest,
} from "@/lib/auth/oauth/authorize-params";
import { createAuthorizationCode } from "@/lib/auth/oauth/consent";
import { isJsonContentType, oauthJson, oauthNotFound } from "@/lib/auth/oauth/http";
import { getSessionUserId } from "@/lib/auth/session-user";
import { isPlainObject } from "@/lib/careerotter/field-guards";
import {
  AGENT_OAUTH_CONSENT_DECISIONS,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_NO_STORE_HEADERS,
  isMcpOAuthEnabled,
  type AgentOAuthConsentDecision,
} from "@/lib/constants/agent-oauth";
import { OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { readBodyWithinLimit } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin-client";
import type {
  AgentOAuthAccountChangedBody,
  AgentOAuthAuthorizeParams,
  AgentOAuthConsentResponseBody,
} from "@/types";

export const runtime = "nodejs";

const ACCOUNT_CHANGED_ERROR = "account_changed" satisfies AgentOAuthAccountChangedBody["error"];

const MESSAGES = {
  forbidden: "Forbidden",
  unauthorized: "Unauthorized",
  body: "Request body must be a JSON object with params, a decision and expectedUserId",
  tooLarge: `Request body must be at most ${AGENT_OAUTH_LIMITS.requestBodyMaxBytes} bytes`,
  invalidRequest: "This connection request is invalid. Start again from your app.",
  grantCap: `You can connect at most ${AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser} apps. Remove one on your data page first.`,
  unavailable: "Could not complete the request. Try again in a moment.",
} as const;

interface ConsentRequest {
  params: URLSearchParams;
  decision: AgentOAuthConsentDecision;
  expectedUserId: string;
  scopes: unknown;
  expiresInDays: unknown;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response };

function errorResponse(message: string, status: number): Response {
  return oauthJson({ error: message }, status, AGENT_OAUTH_NO_STORE_HEADERS);
}

function redirectResponse(redirectUrl: string): Response {
  const body: AgentOAuthConsentResponseBody = { redirectUrl };
  return oauthJson(body, HTTP_STATUS.OK, AGENT_OAUTH_NO_STORE_HEADERS);
}

function accountChangedResponse(): Response {
  const body: AgentOAuthAccountChangedBody = {
    error: ACCOUNT_CHANGED_ERROR,
    message: OAUTH_CONSENT_MESSAGES.accountChanged,
  };
  return oauthJson(body, HTTP_STATUS.CONFLICT, AGENT_OAUTH_NO_STORE_HEADERS);
}

/** A cross-site form or fetch can't send this Origin together with a JSON body. */
function isSameOriginJson(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin && isJsonContentType(request.headers);
}

function isDecision(value: unknown): value is AgentOAuthConsentDecision {
  return AGENT_OAUTH_CONSENT_DECISIONS.some((decision) => decision === value);
}

function toSearchParams(value: unknown): URLSearchParams | null {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value);
  if (!entries.every((entry): entry is [string, string] => typeof entry[1] === "string")) return null;
  return new URLSearchParams(entries);
}

function toConsentRequest(body: unknown): ConsentRequest | null {
  if (!isPlainObject(body) || !isDecision(body.decision)) return null;
  if (typeof body.expectedUserId !== "string") return null;
  const params = toSearchParams(body.params);
  if (params === null) return null;
  return {
    params,
    decision: body.decision,
    expectedUserId: body.expectedUserId,
    scopes: body.scopes,
    expiresInDays: body.expiresInDays,
  };
}

async function readConsentRequest(request: Request): Promise<Parsed<ConsentRequest>> {
  const read = await readBodyWithinLimit(request, AGENT_OAUTH_LIMITS.requestBodyMaxBytes);
  if (!read.ok) {
    const response =
      read.reason === "too_large"
        ? errorResponse(MESSAGES.tooLarge, HTTP_STATUS.PAYLOAD_TOO_LARGE)
        : errorResponse(MESSAGES.body, HTTP_STATUS.BAD_REQUEST);
    return { ok: false, response };
  }
  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return { ok: false, response: errorResponse(MESSAGES.body, HTTP_STATUS.BAD_REQUEST) };
  }
  const parsed = toConsentRequest(body);
  if (parsed === null) return { ok: false, response: errorResponse(MESSAGES.body, HTTP_STATUS.BAD_REQUEST) };
  return { ok: true, value: parsed };
}

async function approve(
  admin: SupabaseClient,
  userId: string,
  params: AgentOAuthAuthorizeParams,
  request: ConsentRequest
): Promise<Response> {
  const access = validateAccessChoice(request.scopes, request.expiresInDays);
  if (!access.ok) return errorResponse(access.message, HTTP_STATUS.BAD_REQUEST);
  const created = await createAuthorizationCode(admin, { userId, params, ...access.value });
  switch (created.kind) {
    case "ok":
      return redirectResponse(authorizationCodeRedirectUrl(params, created.code));
    case "grant_cap":
      return errorResponse(MESSAGES.grantCap, HTTP_STATUS.CONFLICT);
    case "invalid_client":
      return errorResponse(MESSAGES.invalidRequest, HTTP_STATUS.BAD_REQUEST);
    case "unavailable":
      return errorResponse(MESSAGES.unavailable, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  if (!isSameOriginJson(request)) return errorResponse(MESSAGES.forbidden, HTTP_STATUS.FORBIDDEN);
  const userId = await getSessionUserId();
  if (userId === null) return errorResponse(MESSAGES.unauthorized, HTTP_STATUS.UNAUTHORIZED);
  const consent = await readConsentRequest(request);
  if (!consent.ok) return consent.response;
  if (consent.value.expectedUserId !== userId) return accountChangedResponse();

  const admin = createAdminClient();
  const validation = await validateAuthorizeRequest(admin, consent.value.params);
  switch (validation.kind) {
    case "fatal":
      return errorResponse(MESSAGES.invalidRequest, HTTP_STATUS.BAD_REQUEST);
    case "unavailable":
      return errorResponse(MESSAGES.unavailable, HTTP_STATUS.SERVICE_UNAVAILABLE);
    case "redirect_error":
      return redirectResponse(authorizationErrorRedirectUrl(validation));
    case "ok":
      if (consent.value.decision === "deny") {
        return redirectResponse(accessDeniedRedirectUrl(validation.params));
      }
      return approve(admin, userId, validation.params, consent.value);
  }
}
