/**
 * Weekly recap cron (CareerOtter Phase 2, M2c). Friday job: for each user who
 * logged wins this week, generate a short recap they could paste into a 1:1 or
 * review, and store it (the in-app return hook reads the latest one). Idempotent
 * via weekly_recaps' unique (user_id, week_start).
 *
 * Email dispatch is intentionally NOT wired here: a new sending domain
 * (careerotter.io) must be warmed with SPF/DKIM/DMARC first (M1 owner step).
 * Once warmed, send the stored recap from this same job.
 */

import { NextRequest, NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { weekStartOf } from "@/lib/careerotter/week-start";
import { callOpenAI } from "@/lib/openai/client";
import { VOICE_GUARDRAILS } from "@/lib/ai/voice-guardrails";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 300;

const ENDPOINT = "/api/cron/careerotter-recap";
const MAX_USERS = 200; // Backstop for a runaway job; log if we hit it.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
// Requested page size. The server may cap pages lower (PostgREST max-rows), so
// paging advances by rows actually returned and stops only on an empty page.
const WINS_PAGE_SIZE = 1000;

interface RecapWinRow {
  user_id: string;
  text: string;
  tag: string | null;
  impact_number: string | null;
}

type AdminClient = ReturnType<typeof createAdminClient>;

type LoadWinsResult =
  | { wins: RecapWinRow[]; error: null }
  | { wins: RecapWinRow[]; error: PostgrestError };

/**
 * Page through the week's wins so PostgREST's max-rows cap can't silently drop
 * rows. Ordering by created_at then id keeps pages stable when timestamps tie.
 */
async function loadRecentWins(admin: AdminClient, windowStartIso: string): Promise<LoadWinsResult> {
  const wins: RecapWinRow[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await admin
      .from("wins")
      .select("user_id, text, tag, impact_number")
      .gte("created_at", windowStartIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + WINS_PAGE_SIZE - 1);

    if (error) return { wins, error };

    const page: RecapWinRow[] = data ?? [];
    if (page.length === 0) return { wins, error: null };
    wins.push(...page);
    from += page.length;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request, ENDPOINT)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekStart = weekStartOf(now);
  const windowStartIso = new Date(now.getTime() - MS_PER_WEEK).toISOString();
  const admin = createAdminClient();

  const { wins: recentWins, error } = await loadRecentWins(admin, windowStartIso);

  if (error) {
    loggerService.error("Recap cron: failed to load recent wins", error, {
      category: LogCategory.BUSINESS,
      action: "careerotter_recap_query_failed",
    });
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  // Group wins by user.
  const byUser = new Map<string, { text: string; tag: string | null; impact_number: string | null }[]>();
  for (const w of recentWins) {
    const list = byUser.get(w.user_id) ?? [];
    list.push({ text: w.text, tag: w.tag, impact_number: w.impact_number });
    byUser.set(w.user_id, list);
  }

  const userIds = [...byUser.keys()];
  const capped = userIds.length > MAX_USERS;
  const toProcess = userIds.slice(0, MAX_USERS);
  if (capped) {
    loggerService.warn("Recap cron: user count exceeded cap; some skipped", {
      category: LogCategory.BUSINESS,
      action: "careerotter_recap_capped",
      metadata: { total: userIds.length, cap: MAX_USERS },
    });
  }

  let generated = 0;
  for (const userId of toProcess) {
    const wins = byUser.get(userId) ?? [];
    try {
      const winList = wins
        .map((w, i) => `${i + 1}. ${w.text}${w.impact_number ? ` (${w.impact_number})` : ""}`)
        .join("\n");
      const text = await callOpenAI({
        systemPrompt: VOICE_GUARDRAILS,
        messages: [
          {
            role: "user",
            content: `Here is what I shipped this week:\n${winList}\n\nWrite a short recap (3-5 sentences) I could paste into a 1:1 or review doc. First person, my voice, no otter personality. Use only these wins.`,
          },
        ],
        maxTokens: 400,
        temperature: 0.5,
      });

      const { error: upsertError } = await admin.from("weekly_recaps").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          generated_text: text,
          wins_included: wins.length,
        },
        { onConflict: "user_id,week_start" }
      );
      if (!upsertError) generated += 1;
    } catch (err) {
      loggerService.error("Recap cron: per-user generation failed", err, {
        category: LogCategory.AI_SERVICE,
        action: "careerotter_recap_user_failed",
        metadata: { userId },
      });
    }
  }

  loggerService.info("Recap cron complete", {
    category: LogCategory.BUSINESS,
    action: "careerotter_recap_complete",
    metadata: { weekStart, eligibleUsers: userIds.length, generated },
  });

  return NextResponse.json({ weekStart, eligibleUsers: userIds.length, generated });
}
