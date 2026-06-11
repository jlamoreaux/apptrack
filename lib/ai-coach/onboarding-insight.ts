/**
 * AI Coach Onboarding Anchor (retention Phase 3, Option A)
 *
 * A single, fixed-cost AI Coach teaser shown to EVERY new user during
 * onboarding. Deliberately does NOT go through `checkAICoachAccess` and does
 * NOT consume trial budget — it is a free taster that drives discovery while
 * the full Coach stays gated. Uses the cost model (gpt-4o-mini).
 */

import { callOpenAI } from '@/lib/openai/client';
import { Models } from '@/lib/openai/models';

export interface OnboardingInsightInput {
  company: string;
  role: string;
  jobDescription?: string;
}

const SYSTEM_PROMPT =
  'You are an encouraging career coach. Given a job a user is targeting, give one ' +
  'concise, specific, and actionable insight (gap analysis, a resume keyword to ' +
  'emphasize, or an interview-prep tip). Be warm and concrete. Respond in 3-4 ' +
  'sentences of plain text — no headings, no lists, no markdown.';

/** Trim to at most `max` sentences so the teaser stays short regardless of model drift. */
export function clampSentences(text: string, max = 4): string {
  const trimmed = text.trim();
  const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= max) return trimmed;
  return sentences.slice(0, max).join('').trim();
}

export function buildInsightPrompt({ company, role, jobDescription }: OnboardingInsightInput): string {
  const base = `The user just started tracking this job:\nCompany: ${company}\nRole: ${role}`;
  if (jobDescription && jobDescription.trim()) {
    return `${base}\n\nJob description (may be partial):\n${jobDescription.slice(0, 2000)}`;
  }
  return base;
}

export async function generateOnboardingInsight(
  input: OnboardingInsightInput
): Promise<string> {
  const raw = await callOpenAI({
    model: Models.default,
    temperature: 0.6,
    maxTokens: 220,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildInsightPrompt(input) }],
  });

  return clampSentences(raw);
}
