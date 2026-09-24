/**
 * Comp tracker — delete a single entry (CareerOtter Phase 2, M5).
 *
 * DELETE /api/careerotter/comp/:id   remove a comp entry
 *
 * Scoped to the session user_id, so the service-role admin client (comp_entries
 * is RLS service-role-only) can only ever touch the caller's own rows. An
 * unknown, foreign or non-uuid id is a 404.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { deleteCompEntry } from "@/lib/careerotter/comp-service";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await deleteCompEntry(createAdminClient(), user.id, id);
  if (!deleted.ok) return domainErrorResponse(deleted);

  return NextResponse.json({ success: true });
}
