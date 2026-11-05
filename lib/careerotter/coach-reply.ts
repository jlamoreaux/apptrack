import { callOpenAI } from "@/lib/openai/client";
import type { ChatMessage } from "@/lib/openai/types";
import {
  buildCoachSystemPrompt,
  type CoachGoal,
  type CoachProfile,
  type CoachWin,
} from "./coach-prompt";

interface CoachReplyInput {
  profile: CoachProfile | null;
  wins: CoachWin[];
  goal?: CoachGoal | null;
  messages: ChatMessage[];
  distinctId?: string;
}

/** The coach's model call, shared by the route and the live eval so both exercise the same request. */
export function generateCoachReply({
  profile,
  wins,
  goal,
  messages,
  distinctId,
}: CoachReplyInput): Promise<string> {
  return callOpenAI({
    systemPrompt: buildCoachSystemPrompt(profile, wins, goal),
    messages,
    maxTokens: 900,
    temperature: 0.5,
    tracking: { feature: "careerotter_coach", distinctId },
  });
}
