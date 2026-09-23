/**
 * Session-cookie authentication for routes that must not accept extension
 * Bearer JWTs or personal access tokens (see getAuthenticatedUser for the
 * variant that does).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const UNAUTHORIZED_STATUS = 401;

/** The signed-in user's id from the session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: UNAUTHORIZED_STATUS });
}
