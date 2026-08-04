/**
 * One-click data export (CareerOtter Phase 2, M2c privacy posture).
 *
 * GET /api/careerotter/export -> a JSON download of everything CareerOtter holds
 * for the signed-in user: their goal frame, wins, weekly recaps, and comp
 * history. "Export anytime" is part of the stated data posture before marketing
 * to employed professionals (RFC §5).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [profile, wins, recaps, comp] = await Promise.all([
    admin.from("career_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("wins").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    admin.from("weekly_recaps").select("*").eq("user_id", user.id).order("week_start", { ascending: true }),
    admin.from("comp_entries").select("*").eq("user_id", user.id).order("effective_date", { ascending: true }),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    career_profile: profile.data ?? null,
    wins: wins.data ?? [],
    weekly_recaps: recaps.data ?? [],
    comp_entries: comp.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="careerotter-export.json"',
    },
  });
}
