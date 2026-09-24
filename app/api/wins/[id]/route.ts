/**
 * Wins API — edit / delete a single win (CareerOtter Phase 2, M2).
 *
 * PATCH  /api/wins/:id   edit text / impact_number / tag (sets edited_at)
 * DELETE /api/wins/:id   remove a win
 *
 * Both go through lib/careerotter/wins-service.ts, which scopes every mutation
 * to the session user_id, so the service-role admin client can only ever touch
 * the caller's own rows. A non-uuid id is a 404, like any other unknown win.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import {
  WIN_REST_SELECT,
  deleteWin,
  updateWin,
} from "@/lib/careerotter/wins-service";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await updateWin(createAdminClient(), user.id, id, body, {
    select: WIN_REST_SELECT,
  });
  if (!result.ok) return domainErrorResponse(result);

  return NextResponse.json({ win: result.value });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteWin(createAdminClient(), user.id, id);
  if (!result.ok) return domainErrorResponse(result);

  return NextResponse.json({ success: true });
}
