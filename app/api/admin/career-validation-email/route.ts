/**
 * Career Companion Validation Email Trigger
 *
 * POST /api/admin/career-validation-email
 * Authorization: Bearer <CRON_SECRET> (owner-triggered admin route; the
 * CRON_SECRET reuse is an accepted single-operator trade-off, see PRD)
 *
 * Body:
 *   dryRun?: true to get per-audience recipient counts without sending
 *   testEmail?: send a single test email instead of the full audience
 *   audiences?: which segments to send to (default: signed-up users)
 *   force?: resend even though the campaign_sends marker already exists
 *
 * Idempotency: the campaign_sends marker row is inserted BEFORE sending —
 * its primary key atomically rejects a concurrent second trigger. If the
 * send fails afterwards the marker remains (fail-closed): inspect Resend,
 * then retry with force: true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PostHog } from 'posthog-node';
import { verifyCronAuth } from '@/lib/email/lifecycle-cron';
import { getAudienceCount, sendBroadcast } from '@/lib/email/broadcast';
import type { BroadcastResult, SentRecipient } from '@/lib/email/broadcast';
import type { AudienceId } from '@/lib/email/audiences';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { CAREER_CAMPAIGN } from '@/lib/constants/career';
import {
  DEFAULT_CAREER_VALIDATION_FROM,
  DEFAULT_CAREER_VALIDATION_REPLY_TO,
  CAREER_VALIDATION_SUBJECT,
  getCareerValidationHtml,
} from '@/lib/email/templates/career-validation';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export const maxDuration = 300;

const ENDPOINT = '/api/admin/career-validation-email';

// Mirrors CAREER_EVENTS.EMAIL_SENT in lib/analytics/career-events.ts, which
// can't be imported here: it pulls in a "use client" hook module.
const CAREER_EMAIL_SENT_EVENT = 'career_email_sent';

// Owner-confirmed (2026-07-10): send to the entire list, leads included.
const DEFAULT_AUDIENCES: AudienceId[] = ['leads', 'free-users', 'trial-users', 'paid-users'];
const VALID_AUDIENCES: readonly AudienceId[] = ['leads', 'free-users', 'trial-users', 'paid-users'];

// Batch PostHog captures instead of the shared client's flushAt: 1, which
// would cost one HTTP request per recipient inside this route's time budget.
const POSTHOG_FLUSH_AT = 100;

const PG_UNIQUE_VIOLATION = '23505';

// Shape after JSON.parse — every field is untrusted and validated at runtime.
type RequestBody = {
  dryRun?: unknown;
  testEmail?: unknown;
  audiences?: unknown;
  force?: unknown;
};

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

function parseAudiences(raw: unknown): AudienceId[] | null {
  if (raw === undefined) {
    return DEFAULT_AUDIENCES;
  }
  // Untrusted JSON: a non-array (string/number/object) would blow up .every below.
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const allValid = raw.every((audience): audience is AudienceId =>
    (VALID_AUDIENCES as readonly string[]).includes(audience)
  );
  if (!allValid) {
    return null;
  }
  // Dedupe so a repeated id (e.g. ["leads","leads"]) can't send twice — the
  // per-campaign marker is claimed once and wouldn't catch it.
  return [...new Set(raw as AudienceId[])];
}

type MarkerClaim = 'claimed' | 'already-sent' | 'error';

/**
 * Insert the campaign marker row before any email goes out. The primary key
 * on campaign_sends.campaign is the concurrency guard: a second trigger hits
 * a unique violation instead of double-sending. force upserts over it.
 */
async function claimCampaignMarker(
  supabase: AdminSupabaseClient,
  audiences: AudienceId[],
  force: boolean
): Promise<MarkerClaim> {
  const row = {
    campaign: CAREER_CAMPAIGN,
    sent_at: new Date().toISOString(),
    recipient_count: 0,
    metadata: { audiences },
  };

  const { error } = force
    ? await supabase.from('campaign_sends').upsert(row, { onConflict: 'campaign' })
    : await supabase.from('campaign_sends').insert(row);

  if (!error) {
    return 'claimed';
  }
  if (error.code === PG_UNIQUE_VIOLATION) {
    return 'already-sent';
  }

  loggerService.error('Failed to write campaign_sends marker', error, {
    category: LogCategory.EMAIL,
    action: 'career_validation_marker_failed',
    metadata: { campaign: CAREER_CAMPAIGN, force },
  });
  return 'error';
}

/**
 * Fire career_email_sent per successful recipient through a local batched
 * PostHog client. Distinct id is user_id when known, else the email address
 * (audience_members.user_id is nullable) — the gate insight reads counts,
 * not identity joins. Never throws: emails are already out at this point.
 */
async function captureEmailSentEvents(recipients: SentRecipient[]): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey || recipients.length === 0) {
    if (!apiKey) {
      loggerService.warn('PostHog key missing; career_email_sent events skipped', {
        category: LogCategory.EMAIL,
        action: 'career_validation_events_skipped',
      });
    }
    return;
  }

  const client = new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: POSTHOG_FLUSH_AT,
  });

  try {
    for (const recipient of recipients) {
      client.capture({
        distinctId: recipient.userId ?? recipient.email,
        event: CAREER_EMAIL_SENT_EVENT,
        properties: { campaign: CAREER_CAMPAIGN },
      });
    }
    await client.shutdown();
  } catch (error) {
    loggerService.error('Failed to flush career_email_sent events', error, {
      category: LogCategory.EMAIL,
      action: 'career_validation_events_failed',
      metadata: { recipientCount: recipients.length },
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request, ENDPOINT)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    // Empty body is valid: every field has a default.
    body = {};
  }

  const audiences = parseAudiences(body.audiences);
  if (!audiences) {
    return NextResponse.json(
      { error: `audiences must be a non-empty subset of: ${VALID_AUDIENCES.join(', ')}` },
      { status: 400 }
    );
  }

  // This campaign sends from the founder personally with replies routed to a
  // real inbox. Refuse to send if the resolved from address is empty or still
  // points at Resend's test address; surface even on dry runs.
  const fromEmail = process.env.CAREER_VALIDATION_FROM || DEFAULT_CAREER_VALIDATION_FROM;
  const replyTo = process.env.CAREER_VALIDATION_REPLY_TO || DEFAULT_CAREER_VALIDATION_REPLY_TO;
  if (!fromEmail || fromEmail.includes('onboarding@resend.dev')) {
    return NextResponse.json(
      { error: 'CAREER_VALIDATION_FROM is not configured with a verified sender address' },
      { status: 500 }
    );
  }

  if (body.dryRun) {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const audience of audiences) {
      const count = await getAudienceCount(audience);
      counts[audience] = count;
      total += count;
    }
    return NextResponse.json({ dryRun: true, audiences: counts, total });
  }

  const getHtml = (params: { email: string; firstName?: string; unsubscribeUrl: string }) =>
    getCareerValidationHtml({ firstName: params.firstName, unsubscribeUrl: params.unsubscribeUrl });

  if (body.testEmail !== undefined) {
    // Untrusted JSON: reject a non-string testEmail before it reaches
    // sendBroadcast's .trim().toLowerCase() (which would throw a 500).
    if (typeof body.testEmail !== 'string' || !body.testEmail.trim()) {
      return NextResponse.json(
        { error: 'testEmail must be a non-empty string' },
        { status: 400 }
      );
    }
    // testEmail short-circuits recipient lookup inside sendBroadcast; the
    // audience only labels the result. No marker, no analytics events.
    const result = await sendBroadcast({
      audience: audiences[0],
      subject: CAREER_VALIDATION_SUBJECT,
      from: fromEmail,
      replyTo,
      testEmail: body.testEmail,
      getHtml,
    });
    return NextResponse.json({
      testEmail: body.testEmail,
      sent: result.sent,
      failed: result.failed,
    });
  }

  const supabase = createAdminClient();
  const claim = await claimCampaignMarker(supabase, audiences, body.force === true);
  if (claim === 'already-sent') {
    return NextResponse.json(
      {
        error: `Campaign "${CAREER_CAMPAIGN}" has already been sent. Inspect Resend first, then retry with force: true — scope to the specific audiences (e.g. any failedAudiences from the prior response) to avoid re-emailing segments that already received it.`,
      },
      { status: 409 }
    );
  }
  if (claim === 'error') {
    return NextResponse.json({ error: 'Failed to record campaign marker' }, { status: 500 });
  }

  try {
    const results: BroadcastResult[] = [];
    const sentRecipients: SentRecipient[] = [];
    const failedAudiences: AudienceId[] = [];

    // Each audience is isolated: one audience throwing must not abort the loop,
    // because that would leave the marker in place and force a full-campaign
    // force:true retry that re-emails the audiences that already succeeded.
    // Instead we report failedAudiences so the operator can resend only those
    // (force: true, audiences: [...failedAudiences]).
    for (const audience of audiences) {
      try {
        const result = await sendBroadcast({
          audience,
          subject: CAREER_VALIDATION_SUBJECT,
          from: fromEmail,
          replyTo,
          getHtml,
        });
        results.push({
          audience: result.audience,
          total: result.total,
          sent: result.sent,
          failed: result.failed,
        });
        sentRecipients.push(...result.sentRecipients);
      } catch (audienceError) {
        failedAudiences.push(audience);
        loggerService.error('Career validation audience send failed', audienceError, {
          category: LogCategory.EMAIL,
          action: 'career_validation_audience_failed',
          metadata: { campaign: CAREER_CAMPAIGN, audience },
        });
      }
    }

    await captureEmailSentEvents(sentRecipients);

    const totals = results.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        sent: acc.sent + r.sent,
        failed: acc.failed + r.failed,
      }),
      { total: 0, sent: 0, failed: 0 }
    );

    // The durable denominator for the Phase 0 gate.
    const { error: updateError } = await supabase
      .from('campaign_sends')
      .update({ recipient_count: totals.sent })
      .eq('campaign', CAREER_CAMPAIGN);
    if (updateError) {
      loggerService.error('Failed to persist recipient_count on campaign marker', updateError, {
        category: LogCategory.EMAIL,
        action: 'career_validation_marker_update_failed',
        metadata: { campaign: CAREER_CAMPAIGN, sent: totals.sent },
      });
    }

    loggerService.info('Career validation broadcast complete', {
      category: LogCategory.BUSINESS,
      action: 'career_validation_broadcast_complete',
      metadata: { campaign: CAREER_CAMPAIGN, ...totals },
    });

    return NextResponse.json({ audiences: results, failedAudiences, ...totals });
  } catch (error) {
    loggerService.error('Career validation broadcast failed', error, {
      category: LogCategory.EMAIL,
      action: 'career_validation_broadcast_failed',
      metadata: { campaign: CAREER_CAMPAIGN },
    });
    // Fail closed: the marker stays so a blind retry can't double-send.
    return NextResponse.json(
      {
        error:
          'Broadcast failed after the campaign marker was written. Inspect Resend before retrying with force: true.',
      },
      { status: 500 }
    );
  }
}
