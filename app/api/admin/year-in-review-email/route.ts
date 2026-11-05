/**
 * Year in review announcement — owner-triggered, one call per wave.
 *
 * POST /api/admin/year-in-review-email
 * Authorization: Bearer <CRON_SECRET> (same single-operator trade-off as the
 * other admin email routes).
 *
 * Body (every field defaults to the SAFE path — dry run):
 *   wave        — "launch" (early December) or "last-call" (early January). Required.
 *   year?       — the recap year; defaults to the year a user would see today.
 *   dryRun?     — forces the count-only path even with confirm/testEmail set.
 *   confirm?    — must be boolean true to send to real users.
 *   testEmail?  — send every version of this wave to one address instead.
 *   force?      — start the wave over after it completed.
 *
 * Real-send guard (all required, else refused): NODE_ENV==="production",
 * ALLOW_REAL_SEND==="1", not CI, and the recap itself is live
 * (YEAR_IN_REVIEW_ENABLED=1), so the email can never link to a 404.
 *
 * Long lists: the run stops starting batches before the route's time limit
 * and reports `remaining`. Call again with the same body to resume.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/email/lifecycle-cron';
import { sendEmail } from '@/lib/email/client';
import { buildRecipientEmail, runYearInReviewCampaign } from '@/lib/email/year-in-review-campaign';
import { isYearInReviewWave, YEAR_IN_REVIEW_WAVES } from '@/lib/email/templates/year-in-review';
import { findRecapRecipients, type RecapRecipient } from '@/lib/year-in-review/email-recipients';
import { isYearInReviewEnabled } from '@/lib/year-in-review/gate';
import { defaultReviewYear, isReviewableYear } from '@/lib/year-in-review/years';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export const maxDuration = 300;

const ENDPOINT = '/api/admin/year-in-review-email';

// Leave room after the last batch to save progress and respond.
const TIME_BUDGET_MS = 240_000;

type RequestBody = {
  wave?: unknown;
  year?: unknown;
  dryRun?: unknown;
  confirm?: unknown;
  testEmail?: unknown;
  force?: unknown;
};

function realSendAllowed(): boolean {
  return (
    !process.env.CI &&
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_REAL_SEND === '1'
  );
}

function countByAudience(recipients: RecapRecipient[]) {
  return {
    total: recipients.length,
    labeled: recipients.filter((r) => r.audience === 'labeled').length,
    light: recipients.filter((r) => r.audience === 'light').length,
    hired: recipients.filter((r) => r.hired).length,
  };
}

/** One sample per version, sent to the test address. */
function testRecipients(email: string): RecapRecipient[] {
  return [
    { userId: 'test-labeled', email, firstName: 'Test', applications: 39, hired: true, audience: 'labeled' },
    { userId: 'test-light', email, firstName: 'Test', applications: 3, hired: false, audience: 'light' },
  ];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  if (!verifyCronAuth(request, ENDPOINT)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!isYearInReviewWave(body.wave)) {
    return NextResponse.json({ error: `wave must be one of: ${YEAR_IN_REVIEW_WAVES.join(', ')}` }, { status: 400 });
  }
  const wave = body.wave;

  const now = new Date();
  const year = body.year === undefined ? defaultReviewYear(now) : Number(body.year);
  if (!isReviewableYear(year, now)) {
    return NextResponse.json({ error: 'year is not a reviewable year' }, { status: 400 });
  }

  const from = process.env.YEAR_IN_REVIEW_FROM || process.env.FROM_EMAIL;
  const replyTo = process.env.YEAR_IN_REVIEW_REPLY_TO || undefined;
  if (!from || from.includes('onboarding@resend.dev')) {
    return NextResponse.json(
      { error: 'YEAR_IN_REVIEW_FROM (or FROM_EMAIL) must be a verified sender address' },
      { status: 500 }
    );
  }

  const wantsDryRun = body.dryRun === true;
  const wantsRealSend = body.confirm === true;
  const wantsTest = body.testEmail !== undefined;

  // A stale testEmail left in a confirm payload must not pass for a completed send.
  if (wantsRealSend && wantsTest) {
    return NextResponse.json({ error: 'Pass either testEmail or confirm, not both.' }, { status: 400 });
  }

  if (wantsDryRun || (!wantsRealSend && !wantsTest)) {
    const recipients = await findRecapRecipients(year);
    return NextResponse.json({ dryRun: true, wave, year, from, recipients: countByAudience(recipients) });
  }

  if (!realSendAllowed()) {
    return NextResponse.json(
      { error: 'Live send refused. Requires NODE_ENV=production and ALLOW_REAL_SEND=1.' },
      { status: 403 }
    );
  }
  if (!isYearInReviewEnabled()) {
    return NextResponse.json(
      { error: 'Year in review is not live. Set YEAR_IN_REVIEW_ENABLED=1 before emailing about it.' },
      { status: 409 }
    );
  }

  const postalAddress = process.env.COMPANY_POSTAL_ADDRESS;
  if (!postalAddress || !postalAddress.trim()) {
    return NextResponse.json(
      { error: 'COMPANY_POSTAL_ADDRESS must be set (CAN-SPAM requires a physical mailing address)' },
      { status: 500 }
    );
  }

  if (wantsTest) {
    if (typeof body.testEmail !== 'string' || !body.testEmail.trim()) {
      return NextResponse.json({ error: 'testEmail must be a non-empty string' }, { status: 400 });
    }
    const testEmail = body.testEmail.trim().toLowerCase();
    const sent: string[] = [];
    for (const recipient of testRecipients(testEmail)) {
      const email = buildRecipientEmail(recipient, { year, wave, from, replyTo, postalAddress });
      await sendEmail({ to: email.to, subject: email.subject, html: email.html, from, replyTo });
      sent.push(recipient.audience);
    }
    return NextResponse.json({ testEmail, wave, year, sent });
  }

  try {
    const recipients = await findRecapRecipients(year);
    const result = await runYearInReviewCampaign({
      year,
      wave,
      recipients,
      from,
      replyTo,
      postalAddress,
      deadline: startedAt + TIME_BUDGET_MS,
      force: body.force === true,
    });

    if (result.status === 'already-sent') {
      return NextResponse.json(
        {
          error: `Campaign "${result.campaign}" already finished. Retry with force: true only to send it again.`,
          progress: result.progress,
        },
        { status: 409 }
      );
    }
    if (result.status === 'error') {
      return NextResponse.json({ error: result.message, campaign: result.campaign }, { status: 500 });
    }

    if (result.progress.done) {
      await captureServerEvent('year_in_review_broadcast', 'email_broadcast_sent', {
        campaign: result.campaign,
        sent: result.progress.sent,
        skipped: result.progress.skipped,
        failed: result.progress.failed,
      });
    }
    loggerService.info('Year in review email run finished', {
      category: LogCategory.BUSINESS,
      action: 'year_in_review_email_run',
      duration: Date.now() - startedAt,
      metadata: { campaign: result.campaign, remaining: result.remaining, ...result.progress },
    });

    return NextResponse.json({
      campaign: result.campaign,
      recipients: countByAudience(recipients),
      ...result.progress,
      remaining: result.remaining,
    });
  } catch (error) {
    loggerService.error('Year in review email run failed', error, {
      category: LogCategory.EMAIL,
      action: 'year_in_review_email_failed',
      metadata: { wave, year },
    });
    return NextResponse.json(
      { error: 'Send stopped. Progress up to the last finished batch is saved; call again to resume.' },
      { status: 500 }
    );
  }
}
