/**
 * Changelog Generator Service
 *
 * Fetches recent commits from GitHub, uses AI to draft a customer-friendly
 * changelog, and manages changelog_drafts in the database.
 */

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { callOpenAI } from '@/lib/openai/client';
import { Models } from '@/lib/openai/models';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';
import type { ChangelogData } from './templates/changelog';

const GITHUB_OWNER = 'jlamoreaux';
const GITHUB_REPO = 'apptrack';

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
};

/**
 * Fetch recent commits from the GitHub REST API
 */
export async function fetchRecentCommits(days: number): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?since=${since.toISOString()}&per_page=100`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AppTrack-Changelog',
  };

  const token = process.env.GITHUB_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const commits: GitHubCommit[] = await response.json();

  // Extract first line of each commit message, skip merge commits
  return commits
    .map((c) => c.commit.message.split('\n')[0])
    .filter((msg) => !msg.startsWith('Merge pull request') && !msg.startsWith('Merge branch'));
}

/**
 * Use AI to draft a customer-friendly changelog from commit messages
 */
export async function generateChangelogDraft(commitMessages: string[]): Promise<ChangelogData> {
  const weekOf = new Date();
  weekOf.setDate(weekOf.getDate() - 7);
  const weekOfStr = weekOf.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const systemPrompt = `You are a product marketing writer for AppTrack, a job application tracking tool with AI-powered career features (resume roasts, job fit analysis, interview prep, cover letters).

Your job is to turn developer commit messages into a concise, customer-friendly weekly changelog.

Rules:
- Group changes into categories: "New Features", "Improvements", "Fixes"
- Omit empty categories
- Each item should be 1 sentence, value-focused (what it means for the user), not technical
- No emojis
- No jargon (no "API", "migration", "endpoint", "refactor", etc.)
- Skip purely internal changes (CI/CD, dev tooling, analytics instrumentation, security patches)
- Combine related commits into a single item
- Keep each category to 3-5 items max
- If a change is about security improvements, just say "Improved security and performance under the hood" as a single Fixes item

Respond with ONLY valid JSON matching this exact structure:
{
  "weekOf": "${weekOfStr}",
  "categories": [
    { "title": "New Features", "items": ["item1", "item2"] },
    { "title": "Improvements", "items": ["item1"] },
    { "title": "Fixes", "items": ["item1"] }
  ]
}`;

  const userMessage = `Here are the commit messages from the past week:\n\n${commitMessages.map((m) => `- ${m}`).join('\n')}`;

  const result = await callOpenAI({
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt,
    model: Models.default,
    maxTokens: 1000,
    temperature: 0.7,
  });

  // Parse the JSON response, stripping markdown code fences if present
  const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as ChangelogData;

  // Validate structure
  if (!parsed.weekOf || !Array.isArray(parsed.categories)) {
    throw new Error('Invalid changelog structure from AI');
  }

  return parsed;
}

/**
 * Save a changelog draft to the database.
 * Idempotent: if a pending draft already exists for this week, returns its ID.
 */
export async function saveChangelogDraft(changelog: ChangelogData): Promise<string> {
  const supabase = createAdminClient();

  // Check for existing pending draft for this week
  const { data: existing } = await supabase
    .from('changelog_drafts')
    .select('id')
    .eq('week_of', changelog.weekOf)
    .eq('status', 'pending')
    .single();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('changelog_drafts')
    .insert({
      week_of: changelog.weekOf,
      content: changelog,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    loggerService.error('Failed to save changelog draft', error, {
      category: LogCategory.EMAIL,
      action: 'changelog_draft_save_failed',
    });
    throw new Error('Failed to save changelog draft');
  }

  return data.id;
}

/**
 * Get a changelog draft by ID
 */
export async function getChangelogDraft(id: string): Promise<{
  id: string;
  week_of: string;
  content: ChangelogData;
  status: string;
} | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('changelog_drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // PGRST116 = not found, which is expected — only log real errors
    if (error.code !== 'PGRST116') {
      loggerService.error('Failed to fetch changelog draft', error, {
        category: LogCategory.EMAIL,
        action: 'changelog_draft_fetch_failed',
        metadata: { id },
      });
    }
    return null;
  }

  return data;
}

/**
 * Mark a draft as approved.
 * Uses optimistic lock (.eq status=pending) to prevent double-approval.
 * Returns true only if a row was actually updated.
 */
export async function markDraftApproved(id: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('changelog_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    loggerService.error('Failed to mark changelog draft as approved', error, {
      category: LogCategory.EMAIL,
      action: 'changelog_draft_approve_failed',
      metadata: { id },
    });
    return false;
  }

  // No rows updated means another request already changed the status
  return (data?.length ?? 0) > 0;
}

/**
 * Mark a draft as sent with results
 */
export async function markDraftSent(
  id: string,
  results: Record<string, unknown>
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('changelog_drafts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_results: results,
    })
    .eq('id', id)
    .select('id');

  if (error) {
    loggerService.error('Failed to mark changelog draft as sent', error, {
      category: LogCategory.EMAIL,
      action: 'changelog_draft_sent_failed',
      metadata: { id },
    });
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Generate HMAC token for changelog approval links.
 * Throws if CRON_SECRET is not configured.
 */
export function generateApproveToken(draftId: string): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('CRON_SECRET is not configured');
  }
  return crypto.createHmac('sha256', secret).update(draftId).digest('hex');
}

/**
 * Verify HMAC token for changelog approval.
 * Returns false for invalid or mismatched tokens (never throws).
 */
export function verifyApproveToken(draftId: string, token: string): boolean {
  try {
    const expected = generateApproveToken(draftId);
    const expectedBuf = Buffer.from(expected);
    const tokenBuf = Buffer.from(token);
    if (expectedBuf.length !== tokenBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}
