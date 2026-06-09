/**
 * Weekly Pipeline Digest (retention Phase 2c)
 *
 * Computes a per-user pipeline summary (active / needs-follow-up / new) and an
 * optional one-line AI Coach insight based on pipeline composition. Sent every
 * Monday by its cron; not scheduled through the drip engine.
 */

import { callOpenAI } from '@/lib/openai/client';
import { Models } from '@/lib/openai/models';
import { clampSentences } from '@/lib/ai-coach/onboarding-insight';
import { TERMINAL_STATUSES, STALE_THRESHOLD_DAYS } from './stale-reminders';
import { fetchApplicationEmailRows } from './application-rows';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export interface DigestApplicationRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  email: string;
  full_name: string | null;
}

export interface PipelineSummary {
  activeCount: number;
  needsFollowUp: number;
  newThisWeek: number;
  statusCounts: Record<string, number>;
}

export interface DigestUserGroup {
  userId: string;
  email: string;
  firstName?: string;
  summary: PipelineSummary;
  sampleJobs: { company: string; role: string; status: string }[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Group flat application rows into per-user digest payloads.
 * Only users with at least one active (non-terminal, non-archived) application
 * are included. Pure function — exported for unit testing.
 */
export function buildDigestGroups(
  rows: DigestApplicationRow[],
  now: Date,
  staleDays = STALE_THRESHOLD_DAYS
): DigestUserGroup[] {
  const staleCutoff = now.getTime() - staleDays * 24 * 60 * 60 * 1000;
  const weekCutoff = now.getTime() - WEEK_MS;
  const terminal = new Set(TERMINAL_STATUSES);

  const byUser = new Map<string, DigestUserGroup>();

  for (const row of rows) {
    let group = byUser.get(row.user_id);
    if (!group) {
      group = {
        userId: row.user_id,
        email: row.email,
        firstName: row.full_name?.split(' ')[0] || undefined,
        summary: { activeCount: 0, needsFollowUp: 0, newThisWeek: 0, statusCounts: {} },
        sampleJobs: [],
      };
      byUser.set(row.user_id, group);
    }

    const isActive = !terminal.has(row.status);
    if (isActive) {
      group.summary.activeCount++;
      group.summary.statusCounts[row.status] = (group.summary.statusCounts[row.status] ?? 0) + 1;
      if (new Date(row.updated_at).getTime() < staleCutoff) {
        group.summary.needsFollowUp++;
      }
      if (group.sampleJobs.length < 5) {
        group.sampleJobs.push({ company: row.company, role: row.role, status: row.status });
      }
    }
    if (new Date(row.created_at).getTime() >= weekCutoff) {
      group.summary.newThisWeek++;
    }
  }

  return Array.from(byUser.values()).filter((g) => g.summary.activeCount > 0);
}

export function buildDigestInsightPrompt(group: DigestUserGroup): string {
  const composition = Object.entries(group.summary.statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
  const samples = group.sampleJobs.map((j) => `${j.role} at ${j.company}`).join('; ');
  return `Pipeline composition: ${composition}. Roles: ${samples}. Needs follow-up: ${group.summary.needsFollowUp}.`;
}

const INSIGHT_SYSTEM_PROMPT =
  'You are a career coach. Given a snapshot of a job seeker\'s application pipeline, ' +
  'give ONE short, specific, encouraging observation or suggestion in a single sentence. ' +
  'Plain text only, no markdown.';

/**
 * Generate a one-sentence pipeline insight. Returns undefined on failure so the
 * digest can still send without it.
 */
export async function generateDigestInsight(group: DigestUserGroup): Promise<string | undefined> {
  try {
    const raw = await callOpenAI({
      model: Models.default,
      temperature: 0.5,
      maxTokens: 80,
      systemPrompt: INSIGHT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildDigestInsightPrompt(group) }],
    });
    return clampSentences(raw, 1) || undefined;
  } catch (error) {
    loggerService.warn('Digest insight generation failed', {
      category: LogCategory.AI_SERVICE,
      action: 'digest_insight_failed',
      metadata: { userId: group.userId, message: error instanceof Error ? error.message : 'unknown' },
    });
    return undefined;
  }
}

/**
 * Query all non-archived applications and build per-user digest groups.
 */
export async function findDigestGroups(now = new Date()): Promise<DigestUserGroup[]> {
  const rows = await fetchApplicationEmailRows(
    (query) => query.eq('archived', false),
    'weekly_digest_query_failed'
  );

  return buildDigestGroups(rows, now);
}
