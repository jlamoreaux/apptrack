/**
 * Coach v1 (CareerOtter Phase 2, M3).
 *
 * POST /api/careerotter/coach   { messages: {role, content}[] }
 *
 * Pro-only (it calls the model). Grounded exclusively in the user's logged wins,
 * goal, and review date via buildCoachSystemPrompt. Returns the assistant reply.
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { callOpenAI } from "@/lib/openai/client";
import { buildCoachSystemPrompt, COACH_PROMPT_VERSION } from "@/lib/careerotter/coach-prompt";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 60;

const MAX_MESSAGES = 30;
const MAX_CONTENT = 4000;

type Msg = { role: "user" | "assistant"; content: string };

function parseMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return null;
  }
  const out: Msg[] = [];
  for (const m of raw) {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null;
    }
    const trimmed = content.trim();
    if (!trimmed) return null;
    out.push({ role, content: trimmed.slice(0, MAX_CONTENT) });
  }
  // The last turn must be from the user.
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pro-gated: the coach is the paid AI layer.
  const plan = await PermissionMiddleware.getUserPlanInfo(user.id);
  if (!plan.isPro) {
    return NextResponse.json(
      { error: "The coach is a Pro feature.", requiredPlan: "Pro" },
      { status: 403 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const messages = parseMessages(body.messages);
  if (!messages) {
    return NextResponse.json(
      { error: "messages must be a non-empty list ending with a user turn" },
      { status: 400 }
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

  let reply = "";
  try {
    reply = await callOpenAI({
      systemPrompt: buildCoachSystemPrompt(profile ?? null, wins ?? []),
      messages,
      maxTokens: 900,
      temperature: 0.5,
    });
  } catch (error) {
    loggerService.error("Coach generation failed", error, {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "coach_generation_failed",
    });
    return NextResponse.json(
      { error: "The coach is unavailable right now. Please try again." },
      { status: 502 }
    );
  }

  after(
    captureServerEvent(user.id, CAREEROTTER_EVENT_NAMES.COACH_MESSAGE_SENT, {
      prompt_version: COACH_PROMPT_VERSION,
      turns: messages.length,
      has_wins: (wins?.length ?? 0) > 0,
    })
  );

  return NextResponse.json({ reply });
}
