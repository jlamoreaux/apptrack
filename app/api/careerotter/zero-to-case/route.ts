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
    if (typeof body.review_date !== "string" || !ISO_DATE.test(body.review_date)) {
      return NextResponse.json(
        { error: "review_date must be YYYY-MM-DD" },
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

  // Idempotent: if already completed, return the stored case (no second call).
  const { data: existing } = await admin
    .from("career_profiles")
    .select("zero_to_case_completed_at, starter_case, mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.zero_to_case_completed_at && existing.starter_case) {
    return NextResponse.json({
      starterCase: existing.starter_case,
      alreadyCompleted: true,
    });
  }

  // Generate the starter case. If the model call fails, still persist the goal
  // frame so onboarding isn't lost — the user can generate later.
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
    return NextResponse.json(
      { error: "Could not generate your case right now. Please try again." },
      { status: 502 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: upsertError } = await admin.from("career_profiles").upsert(
    {
      user_id: user.id,
      mode: mode as CareerMode,
      role,
      level,
      time_in_role: timeInRole,
      target,
      review_date: reviewDate,
      zero_to_case_completed_at: nowIso,
      starter_case: starterCase,
      updated_at: nowIso,
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    loggerService.error("Failed to save career profile", upsertError, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "career_profile_upsert_failed",
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
