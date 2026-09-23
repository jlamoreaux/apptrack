/**
 * Personal access tokens for CareerOtter agents (MCP server).
 *
 * GET    /api/careerotter/agent-tokens  -> { tokens } newest first, with status
 * POST   /api/careerotter/agent-tokens  -> 201 { token, record }; the raw token
 *                                         is returned here and never again
 * DELETE /api/careerotter/agent-tokens  -> { revoked } count of tokens that were
 *                                         still active. Expired unrevoked tokens
 *                                         are revoked too but not counted.
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
import { AGENT_RATE_LIMITS } from "@/lib/constants/agent-access";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { DomainErrorKind, DomainResult } from "@/types";

// The PRD maps the active-token limit to 422 (Unprocessable), not the 429 the
// shared helper uses for quotas, so 429 stays unambiguous for rate limiting.
const ACTIVE_TOKEN_LIMIT_STATUS = 422;
const RATE_LIMITED_STATUS = 429;
const CREATED_STATUS = 201;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const INVALID_JSON_MESSAGE = "Invalid JSON body";

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

  const result = await revokeAllAgentTokens(createAdminClient(), userId, new Date());
  if (!result.ok) return domainErrorResponse(result);

  loggerService.info("All agent tokens revoked", {
    category: LogCategory.AUTH,
    userId,
    action: "agent_tokens_revoked_all",
    metadata: { count: result.value.revoked, activeCount: result.value.activeRevoked },
  });
  return NextResponse.json({ revoked: result.value.activeRevoked });
}
