/**
 * Personal access tokens for CareerOtter agents (MCP server).
 *
 * GET    /api/careerotter/agent-tokens  -> { tokens } newest first, with status
 * POST   /api/careerotter/agent-tokens  -> 201 { token, record }; the raw token
 *                                         is returned here and never again
 * DELETE /api/careerotter/agent-tokens  -> { revoked } count of active tokens revoked
 *
 * Session cookie only: these routes deliberately do not use getAuthenticatedUser
 * (which accepts extension Bearer JWTs) and never accept a personal access
 * token, so a leaked token cannot mint or revoke tokens.
 *
 * Validation and storage live in lib/auth/agent-token.ts; this route maps
 * service results onto HTTP. Raw tokens are never logged.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { createRateLimiter } from "@/lib/redis/client";
import {
  createAgentToken,
  listAgentTokens,
  revokeAllAgentTokens,
} from "@/lib/auth/agent-token";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";
import { AGENT_RATE_LIMITS } from "@/lib/constants/agent-access";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// The PRD maps the active-token limit to 422 (Unprocessable), not the 429 the
// shared helper uses for quotas, so 429 stays unambiguous for rate limiting.
const ACTIVE_TOKEN_LIMIT_STATUS = 422;
const CREATED_STATUS = 201;

const tokenCreateLimiter = createRateLimiter(
  AGENT_RATE_LIMITS.tokenCreate.tokens,
  AGENT_RATE_LIMITS.tokenCreate.window
);

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

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

export async function GET(): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const listed = await listAgentTokens(createAdminClient(), userId, new Date());
  if (!listed.ok) return domainErrorResponse(listed);
  return NextResponse.json({ tokens: listed.value });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  if (await isCreateRateLimited(userId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const created = await createAgentToken(createAdminClient(), userId, body, new Date());
  if (!created.ok) {
    return created.kind === "quota"
      ? NextResponse.json({ error: created.message }, { status: ACTIVE_TOKEN_LIMIT_STATUS })
      : domainErrorResponse(created);
  }

  loggerService.info("Agent token created", {
    category: LogCategory.AUTH,
    userId,
    action: "agent_token_created",
    metadata: { tokenId: created.value.record.id, scopes: created.value.record.scopes },
  });
  return NextResponse.json(created.value, {
    status: CREATED_STATUS,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const revoked = await revokeAllAgentTokens(createAdminClient(), userId, new Date());
  if (!revoked.ok) return domainErrorResponse(revoked);

  loggerService.info("All agent tokens revoked", {
    category: LogCategory.AUTH,
    userId,
    action: "agent_tokens_revoked_all",
    metadata: { count: revoked.value },
  });
  return NextResponse.json({ revoked: revoked.value });
}
