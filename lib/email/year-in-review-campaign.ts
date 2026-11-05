/**
 * Year in review email sender.
 *
 * Unlike the rebrand broadcast (one message to an audience list), each email
 * here is personal, so it goes through Resend's batch API per user. Progress
 * lives on the wave's `campaign_sends` row: recipients are processed in userId
 * order and the cursor is saved after every batch, so a run that hits the
 * route's time limit resumes where it stopped instead of starting over.
 */

import { resend } from './client';
import { getUnsubscribeUrl } from './drip-scheduler';
import { filterSendableRecipients } from './preferences';
import {
  getYearInReviewEmail,
  yearInReviewCampaignId,
  type YearInReviewWave,
} from './templates/year-in-review';
import type { RecapRecipient } from '@/lib/year-in-review/email-recipients';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export const CAMPAIGN_BATCH_SIZE = 100; // Resend batch limit

const PG_UNIQUE_VIOLATION = '23505';

export interface CampaignProgress {
  /** userId of the last recipient handled; the next run starts after it. */
  cursor: string | null;
  sent: number;
  skipped: number;
  failed: number;
  done: boolean;
}

export type CampaignRunResult =
  | { status: 'sent'; campaign: string; progress: CampaignProgress; remaining: number }
  | { status: 'already-sent'; campaign: string; progress: CampaignProgress }
  | { status: 'error'; campaign: string; message: string };

export interface RunCampaignOptions {
  year: number;
  wave: YearInReviewWave;
  recipients: RecapRecipient[];
  from: string;
  replyTo?: string;
  postalAddress: string;
  /** Stop starting new batches after this time (ms since epoch). */
  deadline: number;
  /** Start over from the first recipient even if the wave already ran. */
  force?: boolean;
}

const FRESH: CampaignProgress = { cursor: null, sent: 0, skipped: 0, failed: 0, done: false };

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadProgress(
  supabase: AdminClient,
  campaign: string,
  force: boolean
): Promise<{ progress: CampaignProgress } | { alreadySent: CampaignProgress } | { error: string }> {
  const { data, error } = await supabase
    .from('campaign_sends')
    .select('metadata')
    .eq('campaign', campaign)
    .maybeSingle();
  if (error) return { error: 'Failed to read campaign progress' };

  if (!data) {
    const { error: insertError } = await supabase
      .from('campaign_sends')
      .insert({ campaign, sent_at: new Date().toISOString(), recipient_count: 0, metadata: FRESH });
    if (insertError) {
      return {
        error:
          insertError.code === PG_UNIQUE_VIOLATION
            ? 'Another run claimed this campaign at the same moment'
            : 'Failed to record campaign marker',
      };
    }
    return { progress: { ...FRESH } };
  }

  const saved = { ...FRESH, ...(data.metadata as Partial<CampaignProgress> | null) };
  if (force) return { progress: { ...FRESH } };
  if (saved.done) return { alreadySent: saved };
  return { progress: saved };
}

async function saveProgress(supabase: AdminClient, campaign: string, progress: CampaignProgress) {
  const { error } = await supabase
    .from('campaign_sends')
    .update({ metadata: progress, recipient_count: progress.sent })
    .eq('campaign', campaign);
  if (error) throw new Error('Failed to save campaign progress');
}

export function buildRecipientEmail(
  recipient: RecapRecipient,
  options: Pick<RunCampaignOptions, 'year' | 'wave' | 'from' | 'replyTo' | 'postalAddress'>
) {
  const unsubscribeUrl = getUnsubscribeUrl(recipient.email, 'digest');
  const { subject, html } = getYearInReviewEmail({
    year: options.year,
    wave: options.wave,
    audience: recipient.audience,
    applications: recipient.applications,
    hired: recipient.hired,
    firstName: recipient.firstName,
    unsubscribeUrl,
    postalAddress: options.postalAddress,
  });
  return {
    from: options.from,
    to: recipient.email,
    subject,
    html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    tags: [
      { name: 'campaign', value: yearInReviewCampaignId(options.year, options.wave) },
      { name: 'audience', value: recipient.audience },
    ],
  };
}

/**
 * Send (or resume sending) one wave. Recipients are filtered by the `digest`
 * preference and the master unsubscribe, one batch at a time.
 */
export async function runYearInReviewCampaign(options: RunCampaignOptions): Promise<CampaignRunResult> {
  const campaign = yearInReviewCampaignId(options.year, options.wave);
  if (!resend) return { status: 'error', campaign, message: 'Resend is not configured' };

  const supabase = createAdminClient();
  const loaded = await loadProgress(supabase, campaign, options.force === true);
  if ('error' in loaded) return { status: 'error', campaign, message: loaded.error };
  if ('alreadySent' in loaded) return { status: 'already-sent', campaign, progress: loaded.alreadySent };

  const progress = loaded.progress;
  const pending = options.recipients.filter((r) => progress.cursor === null || r.userId > progress.cursor);
  let handled = 0;

  for (let i = 0; i < pending.length && Date.now() < options.deadline; i += CAMPAIGN_BATCH_SIZE) {
    const batch = pending.slice(i, i + CAMPAIGN_BATCH_SIZE);
    const sendable = await filterSendableRecipients(
      batch.map((r) => ({ userId: r.userId, email: r.email })),
      'digest'
    );
    const eligible = batch.filter((r) => sendable.has(r.userId));
    progress.skipped += batch.length - eligible.length;

    if (eligible.length > 0) {
      const { data, error } = await resend.batch.send(
        eligible.map((r) => buildRecipientEmail(r, options)),
        {
          // Permissive: one bad address fails that email, not the whole batch.
          batchValidation: 'permissive',
          // A crash between sending and saving the cursor must not resend on retry.
          idempotencyKey: `${campaign}/${batch[0].userId}/${batch[batch.length - 1].userId}`,
        }
      );
      if (error || !data) {
        loggerService.error('Year in review batch send failed', error, {
          category: LogCategory.EMAIL,
          action: 'year_in_review_email_batch_failed',
          metadata: { campaign, batchSize: eligible.length },
        });
        // A whole-batch error is Resend-side (rate limit, outage), not bad
        // addresses. Stop before the cursor moves so a resume retries this
        // batch under the same idempotency key.
        throw new Error('Year in review batch send failed');
      }
      const rejected = data.errors?.length ?? 0;
      progress.sent += eligible.length - rejected;
      progress.failed += rejected;
    }

    progress.cursor = batch[batch.length - 1].userId;
    handled += batch.length;
    progress.done = handled === pending.length;
    await saveProgress(supabase, campaign, progress);
  }

  if (pending.length === 0 && !progress.done) {
    progress.done = true;
    await saveProgress(supabase, campaign, progress);
  }

  return { status: 'sent', campaign, progress, remaining: pending.length - handled };
}
