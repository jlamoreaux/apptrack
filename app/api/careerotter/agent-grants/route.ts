/**
 * Connected apps: the OAuth grants a user approved for MCP clients.
 *
 * GET /api/careerotter/agent-grants -> { enabled: true, grants } newest first:
 *                                      active grants plus those revoked or
 *                                      expired in the last 30 days
 *                                   -> { enabled: false, grants: [] } while
 *                                      OAuth is disabled
 *
 * Session cookie only, like the agent token routes: never extension JWTs,
 * personal access tokens or OAuth access tokens. Revoke-all lives on the
 * agent token route and covers grants too.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { getSessionUserId, unauthorizedResponse } from "@/lib/auth/session-user";
import { listAgentGrants } from "@/lib/auth/oauth/grants";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";
import { isMcpOAuthEnabled } from "@/lib/constants/agent-oauth";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return unauthorizedResponse();
  if (!isMcpOAuthEnabled()) {
    return NextResponse.json({ enabled: false, grants: [] }, { headers: NO_STORE_HEADERS });
  }

  const listed = await listAgentGrants(createAdminClient(), userId, new Date());
  if (!listed.ok) return domainErrorResponse(listed);
  return NextResponse.json({ enabled: true, grants: listed.value }, { headers: NO_STORE_HEADERS });
}
