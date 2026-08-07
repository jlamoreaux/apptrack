/**
 * Coach v1 (CareerOtter Phase 2, M3).
 *
 * POST   /api/careerotter/coach   { messages: {role, content}[] }
 * GET    /api/careerotter/coach   -> { summary, messages, updatedAt } (coach memory)
 * DELETE /api/careerotter/coach   clears coach memory (start fresh)
 *
 * Pro-only (it calls the model). Grounded exclusively in the user's logged wins,
 * goal, and review date via buildCoachSystemPrompt. Returns the assistant reply.
 * Each exchange is persisted to coach_memory with a short model-written summary
 * so the next session picks up where the user left off.
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { callOpenAI } from "@/lib/openai/client";
import { Models } from "@/lib/openai/models";
import {
  buildCoachSystemPrompt,
  getCoachGoal,
  COACH_PROMPT_VERSION,
} from "@/lib/careerotter/coach-prompt";
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

/**
 * Write the updated transcript, the active guided-goal id, and a fresh
 * two-sentence summary to coach_memory. Runs in after() — a failure here
 * never blocks the reply.
 */
async function persistMemory(
  userId: string,
  transcript: Msg[],
  goalId: string | null
): Promise<void> {
  const admin = createAdminClient();
  const messages = transcript.slice(-MAX_MESSAGES);
  try {
    let summary: string | null = null;
    try {
      summary = await callOpenAI({
        systemPrompt:
          "Summarize this career-coaching conversation in at most two sentences, written to the user in second person, so they can pick up where they left off next session. Name their goal and the concrete next step if one was agreed. No preamble.",
        messages: [
          {
            role: "user",
            content: messages
              .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
              .join("\n"),
          },
        ],
        model: Models.fast,
        maxTokens: 120,
        temperature: 0.2,
      });
    } catch {
      // Keep the prior summary if the summarizer call fails; the transcript
      // below is the source of truth.
    }

    const { error } = await admin.from("coach_memory").upsert({
      user_id: userId,
      messages,
      goal_id: goalId,
      ...(summary ? { summary } : {}),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (error) {
    loggerService.error("Coach memory persistence failed", error, {
      category: LogCategory.AI_SERVICE,
      userId,
      action: "coach_memory_persist_failed",
    });
  }
}

/** Return the signed-in user's coach memory (summary, transcript, active goal). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("coach_memory")
    .select("summary, messages, goal_id, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    loggerService.error("Coach memory load failed", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "coach_memory_load_failed",
    });
    return NextResponse.json({ error: "Could not load coach memory" }, { status: 500 });
  }

  return NextResponse.json({
    summary: data?.summary ?? null,
    messages: Array.isArray(data?.messages) ? data?.messages : [],
    goalId: data?.goal_id ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

/** Delete the signed-in user's coach memory ("start fresh"). */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("coach_memory").delete().eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not clear coach memory" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Generate a coach reply, then persist the transcript + summary. Pro-only. */
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

  let body: { messages?: unknown; goalId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const messages = parseMessages(body.messages);
  const goal = getCoachGoal(body.goalId);
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
      systemPrompt: buildCoachSystemPrompt(profile ?? null, wins ?? [], goal),
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

  after(() =>
    captureServerEvent(user.id, CAREEROTTER_EVENT_NAMES.COACH_MESSAGE_SENT, {
      prompt_version: COACH_PROMPT_VERSION,
      turns: messages.length,
      has_wins: (wins?.length ?? 0) > 0,
      goal_id: goal?.id ?? null,
    })
  );
  after(() =>
    persistMemory(
      user.id,
      [...messages, { role: "assistant", content: reply }],
      goal?.id ?? null
    )
  );

  return NextResponse.json({ reply });
}
