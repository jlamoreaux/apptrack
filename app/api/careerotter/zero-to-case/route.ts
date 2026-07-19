/**
 * Zero to Case — onboarding (CareerOtter Phase 2, M2).
 *
 * POST /api/careerotter/zero-to-case
 *
 * Three questions in, a starter promo case out. The AI restructures what the
 * user already remembers into evidence language, names the obvious gap, and
 * states one next step, so they leave day one with a real document, not an empty
 * journal. This is the ONE free model call at onboarding (like the roast) — the
 * strict AI/Pro line resumes immediately after. Idempotent: once completed, it
 * returns the stored case without spending another call.
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { callOpenAI } from "@/lib/openai/client";
import { VOICE_GUARDRAILS } from "@/lib/ai/voice-guardrails";
import { CAREER_MODES, type CareerMode } from "@/lib/constants/careerotter";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 60;

const PG_UNIQUE_VIOLATION = "23505";

type Body = {
  mode?: unknown;
  role?: unknown;
  level?: unknown;
  time_in_role?: unknown;
  target?: unknown;
  review_date?: unknown;
  wins?: unknown;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Regex alone accepts calendar-invalid values like 2026-02-30; round-trip the
// parsed components to reject them (a bare `new Date` silently rolls over).
function isValidCalendarDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function str(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function buildPrompt(input: {
  mode: CareerMode;
  role: string | null;
  level: string | null;
  target: string | null;
  reviewDate: string | null;
  wins: string[];
}): string {
  const goal =
    input.mode === "job_search"
      ? "landing a better role"
      : input.mode === "raise"
        ? "a raise"
        : "a promotion";
  const lines = [
    `The user is working toward ${goal}.`,
    input.role ? `Role/level: ${input.role}${input.level ? `, ${input.level}` : ""}.` : "",
    input.target ? `Target: ${input.target}.` : "",
    input.reviewDate ? `Next review date: ${input.reviewDate}.` : "",
    "",
    "Things they shipped or fixed recently:",
    ...input.wins.map((w, i) => `${i + 1}. ${w}`),
    "",
    "Draft a short starter case (200-350 words):",
    "- Restructure their wins into evidence language: situation, action, measurable result where possible.",
    "- Name the single most obvious gap in their case so far.",
    "- End with one concrete next step to take before their review.",
    "Write it in the user's own voice, first person, no otter personality. This is their document.",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // mode — required, one of the fork options.
  const mode = body.mode;
  if (!(CAREER_MODES as readonly string[]).includes(mode as string)) {
    return NextResponse.json(
      { error: `mode must be one of: ${CAREER_MODES.join(", ")}` },
      { status: 400 }
    );
  }
  const role = str(body.role);
  const level = str(body.level, 120);
  const timeInRole = str(body.time_in_role, 120);
  const target = str(body.target, 500);
  let reviewDate: string | null = null;
  if (body.review_date != null && body.review_date !== "") {
    if (typeof body.review_date !== "string" || !isValidCalendarDate(body.review_date)) {
      return NextResponse.json(
        { error: "review_date must be a valid YYYY-MM-DD date" },
        { status: 400 }
      );
    }
    reviewDate = body.review_date;
  }

  const winsInput = Array.isArray(body.wins)
    ? body.wins
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        .map((w) => w.trim().slice(0, 2000))
        .slice(0, 3)
    : [];

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const goalFrame = {
    mode: mode as CareerMode,
    role,
    level,
    time_in_role: timeInRole,
    target,
    review_date: reviewDate,
    updated_at: nowIso,
  };

  // Atomically claim the one free Zero-to-Case run so two concurrent requests
  // can't both spend a model call and seed duplicate wins. Either we create the
  // row already-claimed, or we flip an existing row's completed_at from null.
  let claimed = false;
  const insert = await admin
    .from("career_profiles")
    .insert({ user_id: user.id, ...goalFrame, zero_to_case_completed_at: nowIso })
    .select("user_id")
    .maybeSingle();
  if (!insert.error) {
    claimed = true;
  } else if (insert.error.code === PG_UNIQUE_VIOLATION) {
    const claim = await admin
      .from("career_profiles")
      .update({ ...goalFrame, zero_to_case_completed_at: nowIso })
      .eq("user_id", user.id)
      .is("zero_to_case_completed_at", null)
      .select("user_id")
      .maybeSingle();
    claimed = Boolean(claim.data);
  } else {
    loggerService.error("Failed to claim career profile", insert.error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "career_profile_claim_failed",
    });
    return NextResponse.json({ error: "Failed to save your case" }, { status: 500 });
  }

  if (!claimed) {
    // Already completed by a prior/concurrent run — return the stored case.
    const { data: existing } = await admin
      .from("career_profiles")
      .select("starter_case")
      .eq("user_id", user.id)
      .maybeSingle();
    return NextResponse.json({
      starterCase: existing?.starter_case ?? "",
      alreadyCompleted: true,
    });
  }

  // We own the claim. Generate the case; on failure, release the claim so the
  // user can retry rather than being permanently marked complete with no case.
  let starterCase = "";
  try {
    starterCase = await callOpenAI({
      systemPrompt: VOICE_GUARDRAILS,
      messages: [
        {
          role: "user",
          content: buildPrompt({
            mode: mode as CareerMode,
            role,
            level,
            target,
            reviewDate,
            wins: winsInput,
          }),
        },
      ],
      maxTokens: 800,
      temperature: 0.6,
    });
  } catch (error) {
    loggerService.error("Zero to Case generation failed", error, {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "ztc_generation_failed",
    });
    await admin
      .from("career_profiles")
      .update({ zero_to_case_completed_at: null })
      .eq("user_id", user.id);
    return NextResponse.json(
      { error: "Could not generate your case right now. Please try again." },
      { status: 502 }
    );
  }

  const { error: saveError } = await admin
    .from("career_profiles")
    .update({ starter_case: starterCase, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (saveError) {
    loggerService.error("Failed to save starter case", saveError, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "career_profile_save_failed",
    });
    return NextResponse.json({ error: "Failed to save your case" }, { status: 500 });
  }

  // Seed the wins log from the answers so the tracker isn't empty on day one.
  if (winsInput.length > 0) {
    await admin.from("wins").insert(
      winsInput.map((text) => ({
        user_id: user.id,
        text,
        source: "zero_to_case" as const,
      }))
    );
  }

  after(
    captureServerEvent(user.id, CAREEROTTER_EVENT_NAMES.ZTC_COMPLETED, {
      mode,
      wins_seeded: winsInput.length,
      has_review_date: Boolean(reviewDate),
    })
  );

  return NextResponse.json({ starterCase, alreadyCompleted: false }, { status: 201 });
}
