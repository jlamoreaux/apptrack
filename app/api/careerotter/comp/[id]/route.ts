/**
 * Comp tracker — delete a single entry (CareerOtter Phase 2, M5).
 *
 * DELETE /api/careerotter/comp/:id   remove a comp entry
 *
 * Scoped to the session user_id, so the service-role admin client (comp_entries
 * is RLS service-role-only) can only ever touch the caller's own rows.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("comp_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    loggerService.error("Failed to delete comp entry", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "comp_entry_delete_failed",
    });
    return NextResponse.json(
      { error: "Failed to delete comp entry" },
      { status: 500 }
    );
  }
  if (!data) {
    // No row matched: wrong id or not the caller's entry.
    return NextResponse.json({ error: "Comp entry not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
