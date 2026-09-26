/**
 * Personal access tokens for CareerOtter agents (MCP server).
 *
 * GET    /api/careerotter/agent-tokens  -> { tokens } newest first, with status
 * POST   /api/careerotter/agent-tokens  -> 201 { token, record }; the raw token
 *                                         is returned here and never again
 * DELETE /api/careerotter/agent-tokens  -> revoke all: every token and every
 *                                         connected app (OAuth grant), whether or
 *                                         not OAuth is enabled.
 *                                         { revoked, tokensRevoked, grantsRevoked }
 *                                         where tokensRevoked counts tokens that
 *                                         were still active (expired unrevoked
 *                                         ones are revoked too but not counted).
 *                                         500 { error, tokensRevoked,
 *                                         grantsRevoked } with null for the call
 *                                         that failed.
 *
 * Session cookie only: these routes deliberately do not use getAuthenticatedUser
 * (which accepts extension Bearer JWTs) and never accept a personal access
 * token, so a leaked token cannot mint or revoke tokens.
 *
 * Validation and storage live in lib/auth/agent-token.ts; this route maps
 * service results onto HTTP. Raw tokens are never logged.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { createRateLimiter } from "@/lib/redis/client";
import {
  createAgentToken,
  listAgentTokens,
  revokeAllAgentTokens,
  type CreatedAgentToken,
} from "@/lib/auth/agent-token";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session-user";
import { invalid, ok } from "@/lib/careerotter/domain-result";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";
import { revokeAllAgentGrants } from "@/lib/auth/oauth/grants";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { trackAfterResponse } from "@/lib/careerotter/domain-result";
import { AGENT_RATE_LIMITS } from "@/lib/constants/agent-access";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { AgentOAuthRevokeReason } from "@/lib/constants/agent-oauth";
import type { DomainErrorKind, DomainResult } from "@/types";

// The PRD maps the active-token limit to 422 (Unprocessable), not the 429 the
// shared helper uses for quotas, so 429 stays unambiguous for rate limiting.
const ACTIVE_TOKEN_LIMIT_STATUS = 422;
const RATE_LIMITED_STATUS = 429;
const CREATED_STATUS = 201;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const INVALID_JSON_MESSAGE = "Invalid JSON body";
const REVOKE_ALL_FAILED_MESSAGE = "Failed to revoke everything. Try again.";
const REVOKE_ALL_GRANTS_REASON = "user_all" satisfies AgentOAuthRevokeReason;

const tokenCreateLimiter = createRateLimiter(
  AGENT_RATE_LIMITS.tokenCreate.tokens,
  AGENT_RATE_LIMITS.tokenCreate.window
);

// Fails open when Redis is unreachable: the caller already holds a valid
// session, and the active-token limit still caps what they can mint.
async function isCreateRateLimited(userId: string): Promise<boolean> {
  if (!tokenCreateLimiter) return false;
  try {
    const result = await tokenCreateLimiter.limit(
      `${AGENT_RATE_LIMITS.tokenCreate.keyPrefix}${userId}`
    );
    return !result.success;
  } catch (error) {
    loggerService.error("Agent token rate limiter failed", error, {
      category: LogCategory.SECURITY,
      userId,
      action: "agent_token_rate_limit_error",
    });
    return false;
  }
}

async function parseJsonBody(request: NextRequest): Promise<DomainResult<unknown>> {
  try {
    const body: unknown = await request.json();
    return ok(body);
  } catch {
    return invalid(INVALID_JSON_MESSAGE);
  }
}

function createFailureResponse(failure: { kind: DomainErrorKind; message: string }): NextResponse {
  if (failure.kind !== "quota") return domainErrorResponse(failure);
  return NextResponse.json({ error: failure.message }, { status: ACTIVE_TOKEN_LIMIT_STATUS });
}

function createdResponse(userId: string, created: CreatedAgentToken): NextResponse {
  loggerService.info("Agent token created", {
    category: LogCategory.AUTH,
    userId,
    action: "agent_token_created",
    metadata: { tokenId: created.record.id, scopes: created.record.scopes },
  });
  return NextResponse.json(created, { status: CREATED_STATUS, headers: NO_STORE_HEADERS });
}

// captureServerEvent never rejects, and trackAfterResponse logs a failure to
// schedule, so analytics can't change the response.
function trackGrantsRevoked(userId: string): void {
  const event = CAREEROTTER_EVENT_NAMES.MCP_OAUTH_REVOKED;
  trackAfterResponse({ action: event, userId }, () =>
    captureServerEvent(userId, event, { reason: REVOKE_ALL_GRANTS_REASON })
  );
}

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedResponse();

  const listed = await listAgentTokens(createAdminClient(), userId, new Date());
  if (!listed.ok) return domainErrorResponse(listed);
  return NextResponse.json({ tokens: listed.value }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedResponse();
  if (await isCreateRateLimited(userId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: RATE_LIMITED_STATUS });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return domainErrorResponse(body);
  const created = await createAgentToken(createAdminClient(), userId, body.value, new Date());
  return created.ok ? createdResponse(userId, created.value) : createFailureResponse(created);
}

export async function DELETE(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedResponse();

  const admin = createAdminClient();
  // Grants are revoked even when the tokens call fails, and whether or not
  // OAuth is enabled: "revoke all" should cut off everything it can reach.
  const tokens = await revokeAllAgentTokens(admin, userId, new Date());
  const grants = await revokeAllAgentGrants(admin, userId);
  const tokensRevoked = tokens.ok ? tokens.value.activeRevoked : null;
  const grantsRevoked = grants.ok ? grants.value : null;

  loggerService.info("All agent tokens and connected apps revoked", {
    category: LogCategory.AUTH,
    userId,
    action: "agent_tokens_revoked_all",
    metadata: {
      count: tokens.ok ? tokens.value.revoked : null,
      activeCount: tokensRevoked,
      grantsRevoked,
    },
  });
  if (grantsRevoked !== null && grantsRevoked > 0) trackGrantsRevoked(userId);

  // The two calls aren't atomic; both are idempotent, so a retry is safe.
  if (tokensRevoked === null || grantsRevoked === null) {
    return NextResponse.json(
      { error: REVOKE_ALL_FAILED_MESSAGE, tokensRevoked, grantsRevoked },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
  return NextResponse.json({ revoked: tokensRevoked + grantsRevoked, tokensRevoked, grantsRevoked });
}
