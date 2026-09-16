/**
 * Career profile — the goal frame Today counts down to.
 *
 * GET   /api/careerotter/profile   -> { profile }
 * PATCH /api/careerotter/profile   -> { profile }
 *
 * Zero to Case writes this row at onboarding, and everything on Today (the
 * countdown, the next move, the coach's framing) reads it — so it has to stay
 * editable as someone's role, target or review date changes. Free for everyone:
 * the goal frame calls no model.
 *
 * PATCH is a partial upsert: a user who skipped onboarding has no row, so the
 * first PATCH creates one. Omitted fields are left alone; an explicit null
 * clears the field.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import {
  CAREER_MODES,
  CAREER_PROFILE_LIMITS,
  type CareerMode,
} from "@/lib/constants/careerotter";
import { isIsoCalendarDate } from "@/lib/utils/date";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const PROFILE_COLUMNS =
  "mode, role, level, time_in_role, target, review_date, zero_to_case_completed_at, starter_case";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("career_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    loggerService.error("Failed to load career profile", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "career_profile_load_failed",
    });
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

type PatchBody = {
  mode?: unknown;
  role?: unknown;
  level?: unknown;
  target?: unknown;
  review_date?: unknown;
};

/**
 * Normalize an editable text field. `undefined` means "not supplied, leave it";
 * null or an empty string means "clear it".
 */
function textField(
  value: unknown,
  max: number
): { ok: true; value: string | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  return { ok: true, value: trimmed ? trimmed.slice(0, max) : null };
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};

  if (body.mode !== undefined) {
    if (!CAREER_MODES.includes(body.mode as CareerMode)) {
      return NextResponse.json(
        { error: `mode must be one of: ${CAREER_MODES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.mode = body.mode as CareerMode;
  }

  const textFields: [keyof PatchBody, string, number][] = [
    ["role", "role", CAREER_PROFILE_LIMITS.roleMax],
    ["level", "level", CAREER_PROFILE_LIMITS.levelMax],
    ["target", "target", CAREER_PROFILE_LIMITS.targetMax],
  ];
  for (const [key, column, max] of textFields) {
    if (body[key] === undefined) continue;
    const parsed = textField(body[key], max);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `${column} must be a string or null` },
        { status: 400 }
      );
    }
    updates[column] = parsed.value;
  }

  if (body.review_date !== undefined) {
    if (body.review_date === null || body.review_date === "") {
      updates.review_date = null;
    } else if (isIsoCalendarDate(body.review_date)) {
      updates.review_date = body.review_date;
    } else {
      return NextResponse.json(
        { error: "review_date must be a YYYY-MM-DD date or null" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Read-then-write rather than upsert: an upsert has to send every column it
  // wants defaulted, which would clobber the stored `mode` of an existing row
  // on any PATCH that doesn't include it.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("career_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const query = existing
    ? admin.from("career_profiles").update(updates).eq("user_id", user.id)
    : admin.from("career_profiles").insert({ user_id: user.id, ...updates });

  const { data, error } = await query.select(PROFILE_COLUMNS).single();

  if (error) {
    loggerService.error("Failed to update career profile", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "career_profile_update_failed",
      metadata: { fields: Object.keys(updates) },
    });
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
