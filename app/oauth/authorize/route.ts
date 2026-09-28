/**
 * The OAuth 2.1 authorization endpoint for the MCP server.
 *
 * GET /oauth/authorize validates the request and redirects; it never renders
 * and writes nothing:
 * - an unknown client or unregistered redirect_uri -> /oauth/error, never the
 *   client
 * - any other problem -> the client's redirect_uri with error,
 *   error_description, state and iss
 * - signed out -> /login, returning to the consent page afterwards
 * - signed in -> the consent page
 * Login and consent get a canonical query rebuilt from the validated values.
 *
 * 404 unless isMcpOAuthEnabled().
 */

import { NextResponse } from "next/server";
import {
  authorizationErrorRedirectUrl,
  consentPathFor,
  oauthErrorPath,
  validateAuthorizeRequest,
} from "@/lib/auth/oauth/authorize-params";
import { oauthNotFound } from "@/lib/auth/oauth/http";
import { getSessionUserId } from "@/lib/auth/session-user";
import { isMcpOAuthEnabled } from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loginHref } from "@/lib/utils/auth-redirect";
import type { AgentOAuthAuthorizeValidation } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where the browser goes next: an internal path or the client's absolute URL. */
async function nextLocation(validation: AgentOAuthAuthorizeValidation): Promise<string> {
  switch (validation.kind) {
    case "fatal":
      return oauthErrorPath("invalid");
    case "unavailable":
      return oauthErrorPath("unavailable");
    case "redirect_error":
      return authorizationErrorRedirectUrl(validation);
    case "ok": {
      const consentPath = consentPathFor(validation.params);
      const userId = await getSessionUserId();
      return userId === null ? loginHref(consentPath) : consentPath;
    }
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  const requestUrl = new URL(request.url);
  const validation = await validateAuthorizeRequest(createAdminClient(), requestUrl.searchParams);
  const location = new URL(await nextLocation(validation), requestUrl.origin);
  return NextResponse.redirect(location, HTTP_STATUS.FOUND);
}
