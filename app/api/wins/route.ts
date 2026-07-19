/**
 * Wins API — the evidence log (CareerOtter Phase 2, M2).
 *
 * GET  /api/wins        list the current user's wins (newest first)
 * POST /api/wins        log a win
 *
 * Logging is FREE and calls no model (habit before payment, PRD M2). Auth is the
 * session user; writes go through the service-role admin client because the wins
 * table is RLS service-role-only, and every query is scoped to the session
 * user_id so the admin client can't leak across users.
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import {
  WIN_TAGS,
  WIN_SOURCES,
  WIN_LIMITS,
  type WinTag,
  type WinSource,
} from "@/lib/constants/careerotter";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { emailDistinctId } from "@/lib/analytics/anonymize";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

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
    .from("wins")
    .select("id, text, impact_number, tag, source, created_at, edited_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    loggerService.error("Failed to list wins", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "wins_list_failed",
    });
    return NextResponse.json({ error: "Failed to load wins" }, { status: 500 });
  }

  return NextResponse.json({ wins: data ?? [] });
}

type PostBody = {
  text?: unknown;
  impact_number?: unknown;
  tag?: unknown;
  source?: unknown;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // text — required, trimmed, capped.
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

  // impact_number — optional, trimmed, capped.
  let impactNumber: string | null = null;
  if (body.impact_number != null && body.impact_number !== "") {
    if (typeof body.impact_number !== "string") {
      return NextResponse.json(
        { error: "impact_number must be a string" },
        { status: 400 }
      );
    }
    impactNumber = body.impact_number.trim().slice(0, WIN_LIMITS.impactNumberMax);
  }

  // tag — optional, must be one of the four impact areas.
  let tag: WinTag | null = null;
  if (body.tag != null && body.tag !== "") {
    if (!(WIN_TAGS as readonly string[]).includes(body.tag as string)) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }
    tag = body.tag as WinTag;
  }

  // source — optional, defaults to manual (the capture bar).
  let source: WinSource = "manual";
  if (body.source != null && body.source !== "") {
    if (!(WIN_SOURCES as readonly string[]).includes(body.source as string)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    source = body.source as WinSource;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wins")
    .insert({
      user_id: user.id,
      text,
      impact_number: impactNumber,
      tag,
      source,
    })
    .select("id, text, impact_number, tag, source, created_at, edited_at")
    .single();

  if (error) {
    loggerService.error("Failed to log win", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "win_log_failed",
    });
    return NextResponse.json({ error: "Failed to log win" }, { status: 500 });
  }

  // Server-authoritative win_logged. Distinct id is the user id; best-effort.
  after(
    captureServerEvent(user.id ?? emailDistinctId(user.email ?? ""), CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: tag ?? "untagged",
      source,
    })
  );

  return NextResponse.json({ win: data }, { status: 201 });
}
