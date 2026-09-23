/**
 * Personal access tokens for CareerOtter agents — revoke one.
 *
 * DELETE /api/careerotter/agent-tokens/:id  -> { success: true }
 *
 * Session cookie only (never extension JWTs or personal access tokens).
 * Idempotent: revoking an already revoked token succeeds and keeps its original
 * revoked_at. An unknown, foreign or non-uuid id is a 404.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { revokeAgentToken } from "@/lib/auth/agent-token";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session-user";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedResponse();

  const revoked = await revokeAgentToken(createAdminClient(), userId, id, new Date());
  if (!revoked.ok) return domainErrorResponse(revoked);

  return NextResponse.json({ success: true });
}
