/**
 * Broadcast Email Sender
 *
 * Sends one-time emails to audience segments. Used for changelogs,
 * announcements, and other non-drip campaigns.
 */

import { resend } from './client';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { getUnsubscribeUrl } from './drip-scheduler';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';
import type { AudienceId } from './audiences';

type BroadcastRecipient = {
  email: string;
  first_name: string | null;
};

export type BroadcastOptions = {
  audience: AudienceId;
  subject: string;
  getHtml: (params: { email: string; firstName?: string; unsubscribeUrl: string }) => string;
  from?: string;
  testEmail?: string; // Send to a single email instead of the full audience
};

export type BroadcastResult = {
  audience: AudienceId;
  total: number;
  sent: number;
  failed: number;
};

const BATCH_SIZE = 100; // Resend batch limit

/**
 * Send a broadcast email to all subscribed members of an audience
 */
export async function sendBroadcast(options: BroadcastOptions): Promise<BroadcastResult> {
  const { audience, subject, getHtml, testEmail } = options;
  const from = options.from || process.env.FROM_EMAIL || 'AppTrack <onboarding@resend.dev>';

  const result: BroadcastResult = { audience, total: 0, sent: 0, failed: 0 };

  if (!resend) {
    throw new Error('Resend not configured for email broadcast');
  }

  // Get recipients
  let recipients: BroadcastRecipient[];

  if (testEmail) {
    recipients = [{ email: testEmail.trim().toLowerCase(), first_name: null }];
  } else {
    recipients = await getSubscribedMembers(audience);
  }

  result.total = recipients.length;

  if (recipients.length === 0) {
    return result;
  }

  // Send in batches using Resend batch API
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    try {
      const emails = batch.map((recipient) => {
        const unsubscribeUrl = getUnsubscribeUrl(recipient.email);
        const html = getHtml({
          email: recipient.email,
          firstName: recipient.first_name || undefined,
          unsubscribeUrl,
        });

        return {
          from,
          to: recipient.email,
          subject,
          html,
        };
      });

      const { data, error } = await resend.batch.send(emails);

      if (error) {
        loggerService.error('Batch send failed', error, {
          category: LogCategory.EMAIL,
          action: 'broadcast_batch_error',
          metadata: { audience, batchIndex: i, batchSize: batch.length },
        });
        result.failed += batch.length;
      } else {
        result.sent += data?.data?.length || batch.length;
      }
    } catch (error) {
      loggerService.error('Unexpected error in batch send', error, {
        category: LogCategory.EMAIL,
        action: 'broadcast_batch_exception',
        metadata: { audience, batchIndex: i, batchSize: batch.length },
      });
      result.failed += batch.length;
    }
  }

  loggerService.info('Broadcast complete', {
    category: LogCategory.BUSINESS,
    action: 'broadcast_complete',
    metadata: { audience, total: result.total, sent: result.sent, failed: result.failed },
  });

  return result;
}

/**
 * Get all subscribed members for an audience
 */
async function getSubscribedMembers(audience: AudienceId): Promise<BroadcastRecipient[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('audience_members')
    .select('email, first_name')
    .eq('current_audience', audience)
    .eq('subscribed', true);

  if (error) {
    loggerService.error('Failed to fetch audience members for broadcast', error, {
      category: LogCategory.EMAIL,
      action: 'broadcast_fetch_audience_failed',
      metadata: { audience },
    });
    throw new Error(`Failed to fetch audience members for ${audience}: ${error.message}`);
  }

  return data || [];
}

/**
 * Broadcast a changelog to multiple audience segments
 * Shared logic used by both the manual POST route and the approve route.
 */
export async function broadcastChangelog(options: {
  changelog: import('./templates/changelog').ChangelogData;
  audiences: import('@/types').ChangelogAudienceId[];
  testEmail?: string;
}): Promise<{ total: number; sent: number; failed: number; audiences: BroadcastResult[] }> {
  const { getChangelogHtml, getCtaForAudience } = await import('./templates/changelog');
  const { changelog, audiences, testEmail } = options;

  const results: BroadcastResult[] = [];

  for (const audience of audiences) {
    const { ctaText, ctaUrl } = getCtaForAudience(audience);

    const result = await sendBroadcast({
      audience,
      subject: `What's New in AppTrack -- Week of ${changelog.weekOf}`,
      testEmail,
      getHtml: (params) =>
        getChangelogHtml({
          ...params,
          changelog,
          ctaText,
          ctaUrl,
        }),
    });

    results.push(result);
  }

  const totals = results.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      sent: acc.sent + r.sent,
      failed: acc.failed + r.failed,
    }),
    { total: 0, sent: 0, failed: 0 }
  );

  return { ...totals, audiences: results };
}

/**
 * Get count of subscribed members for an audience (for dry runs)
 */
export async function getAudienceCount(audience: AudienceId): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('audience_members')
    .select('*', { count: 'exact', head: true })
    .eq('current_audience', audience)
    .eq('subscribed', true);

  if (error) {
    loggerService.error('Failed to count audience members', error, {
      category: LogCategory.EMAIL,
      action: 'broadcast_count_audience_failed',
      metadata: { audience },
    });
    return 0;
  }

  return count || 0;
}
