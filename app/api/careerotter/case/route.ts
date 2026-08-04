/**
 * Promo case builder (CareerOtter Phase 2, M4).
 *
 * POST /api/careerotter/case  -> generates a structured case document (markdown)
 *
 * Pro-only. Grounded in the user's logged wins + goal via buildCasePrompt. Needs
 * at least a few wins to be worth generating. Fires case_exported.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { callOpenAI } from "@/lib/openai/client";
import { buildCasePrompt, CASE_PROMPT_VERSION } from "@/lib/careerotter/case-prompt";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 60;

const MIN_WINS = 3;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await PermissionMiddleware.getUserPlanInfo(user.id);
  if (!plan.isPro) {
    return NextResponse.json(
      { error: "The case builder is a Pro feature.", requiredPlan: "Pro" },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const [{ data: wins }, { data: profile }] = await Promise.all([
    admin
      .from("wins")
      .select("text, impact_number, tag, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("career_profiles")
      .select("mode, role, level, target, review_date")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!wins || wins.length < MIN_WINS) {
    return NextResponse.json(
      {
        error: `Log at least ${MIN_WINS} wins first — a case needs evidence to stand on.`,
        needsMoreWins: true,
      },
      { status: 422 }
    );
  }

  let markdown = "";
  try {
    markdown = await callOpenAI({
      systemPrompt: buildCasePrompt(profile ?? null, wins),
      messages: [
        { role: "user", content: "Assemble my case document from my logged wins." },
      ],
      maxTokens: 1600,
      temperature: 0.5,
    });
  } catch (error) {
    loggerService.error("Case generation failed", error, {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "case_generation_failed",
    });
    return NextResponse.json(
      { error: "Could not build your case right now. Please try again." },
      { status: 502 }
    );
  }

  after(
    captureServerEvent(user.id, CAREEROTTER_EVENT_NAMES.CASE_EXPORTED, {
      prompt_version: CASE_PROMPT_VERSION,
      wins_used: wins.length,
    })
  );

  return NextResponse.json({ markdown });
}
