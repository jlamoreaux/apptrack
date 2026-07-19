/**
 * Wins API — edit / delete a single win (CareerOtter Phase 2, M2).
 *
 * PATCH  /api/wins/:id   edit text / impact_number / tag (sets edited_at)
 * DELETE /api/wins/:id   remove a win
 *
 * Every mutation is scoped to the session user_id, so the service-role admin
 * client can only ever touch the caller's own rows.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { WIN_TAGS, WIN_LIMITS, type WinTag } from "@/lib/constants/careerotter";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

type PatchBody = {
  text?: unknown;
  impact_number?: unknown;
  tag?: unknown;
};

export async function PATCH(
  request: NextRequest,
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

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: {
    text?: string;
    impact_number?: string | null;
    tag?: WinTag | null;
    edited_at: string;
  } = { edited_at: new Date().toISOString() };

  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Win text is required" }, { status: 400 });
    }
    if (text.length > WIN_LIMITS.textMax) {
      return NextResponse.json(
        { error: `Win text must be ${WIN_LIMITS.textMax} characters or fewer` },
        { status: 400 }
      );
    }
    update.text = text;
  }

  if (body.impact_number !== undefined) {
    if (body.impact_number === null || body.impact_number === "") {
      update.impact_number = null;
    } else if (typeof body.impact_number === "string") {
      update.impact_number = body.impact_number
        .trim()
        .slice(0, WIN_LIMITS.impactNumberMax);
    } else {
      return NextResponse.json(
        { error: "impact_number must be a string" },
        { status: 400 }
      );
    }
  }

  if (body.tag !== undefined) {
    if (body.tag === null || body.tag === "") {
      update.tag = null;
    } else if ((WIN_TAGS as readonly string[]).includes(body.tag as string)) {
      update.tag = body.tag as WinTag;
    } else {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wins")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, text, impact_number, tag, source, created_at, edited_at")
    .single();

  if (error || !data) {
    // No row (wrong id or not the owner) surfaces as 404, not 500.
    if (error?.code === "PGRST116" || !data) {
      return NextResponse.json({ error: "Win not found" }, { status: 404 });
    }
    loggerService.error("Failed to update win", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "win_update_failed",
    });
    return NextResponse.json({ error: "Failed to update win" }, { status: 500 });
  }

  return NextResponse.json({ win: data });
}

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
    .from("wins")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    loggerService.error("Failed to delete win", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "win_delete_failed",
    });
    return NextResponse.json({ error: "Failed to delete win" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Win not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
