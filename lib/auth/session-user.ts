/**
 * Session-cookie authentication for routes that must not accept extension
 * Bearer JWTs or personal access tokens (see getAuthenticatedUser for the
 * variant that does).
 */

import { NextResponse } from "next/server";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types";

/** The signed-in user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/** The signed-in user's id from the session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  return (await getSessionUser())?.id ?? null;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_STATUS.UNAUTHORIZED });
}
