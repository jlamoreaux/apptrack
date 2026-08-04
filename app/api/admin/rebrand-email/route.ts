/**
 * AppTrack -> CareerOtter rename announcement — owner-triggered broadcast.
 *
 * POST /api/admin/rebrand-email
 * Authorization: Bearer <CRON_SECRET> (owner-triggered admin route; the
 * CRON_SECRET reuse is the same single-operator trade-off as the other admin
 * email routes).
 *
 * Body (every field defaults to the SAFE path — dry run):
 *   dryRun?     — informational; a real send is gated on `confirm`, not this.
 *   confirm?    — must be boolean true to attempt a real broadcast.
 *   testEmail?  — send one live test to this address (no marker, no events).
 *   audiences?  — subset of leads/free-users/trial-users/paid-users.
 *   force?      — upsert over an existing campaign marker to resend.
 *
 * Real-send guard (all three required, else refused): NODE_ENV==="production"
 * AND ALLOW_REAL_SEND==="1" AND confirm===true. This route refuses to mass-send
 * anywhere else, so the announcement can't fire from CI, preview, or a dev shell.
 *
 * Idempotency: the campaign_sends marker (PK on `campaign`) is written before
 * any mail goes out; a second trigger hits a unique violation instead of
 * double-blasting the list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/email/lifecycle-cron';
import { getAudienceCount, sendBroadcast } from '@/lib/email/broadcast';
import type { BroadcastResult, SentRecipient } from '@/lib/email/broadcast';
import type { AudienceId } from '@/lib/email/audiences';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { REBRAND_CAMPAIGN } from '@/lib/constants/rebrand';
import {
  DEFAULT_REBRAND_FROM,
  DEFAULT_REBRAND_REPLY_TO,
  REBRAND_ANNOUNCEMENT_SUBJECT,
  getRebrandAnnouncementHtml,
} from '@/lib/email/templates/rebrand-announcement';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export const maxDuration = 300;

const ENDPOINT = '/api/admin/rebrand-email';

const VALID_AUDIENCES: readonly AudienceId[] = ['leads', 'free-users', 'trial-users', 'paid-users'];
const DEFAULT_AUDIENCES: AudienceId[] = [...VALID_AUDIENCES];

// The announcement must go out from the WARMED sending domain, never the fresh
// careerotter.io (which would tank deliverability) or Resend's test address.
const EXPECTED_SENDER_DOMAIN = 'apptrack.ing';

const PG_UNIQUE_VIOLATION = '23505';

type RequestBody = {
  dryRun?: unknown;
  confirm?: unknown;
  testEmail?: unknown;
  audiences?: unknown;
  force?: unknown;
};

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

function parseAudiences(raw: unknown): AudienceId[] | null {
  if (raw === undefined) {
    return DEFAULT_AUDIENCES;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const allValid = raw.every((audience): audience is AudienceId =>
    (VALID_AUDIENCES as readonly string[]).includes(audience)
  );
  if (!allValid) {
    return null;
  }
  return [...new Set(raw as AudienceId[])];
}

function realSendAllowed(): boolean {
  // Refuse in CI even if NODE_ENV/ALLOW_REAL_SEND happen to be set on the runner.
  return (
    !process.env.CI &&
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_REAL_SEND === '1'
  );
}

type MarkerClaim = 'claimed' | 'already-sent' | 'error';

async function claimCampaignMarker(
  supabase: AdminSupabaseClient,
  audiences: AudienceId[],
  force: boolean
): Promise<MarkerClaim> {
  const row = {
    campaign: REBRAND_CAMPAIGN,
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

  loggerService.error('Failed to write rebrand campaign marker', error, {
    category: LogCategory.EMAIL,
    action: 'rebrand_email_marker_failed',
    metadata: { campaign: REBRAND_CAMPAIGN, force },
  });
  return 'error';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request, ENDPOINT)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const audiences = parseAudiences(body.audiences);
  if (!audiences) {
    return NextResponse.json(
      { error: `audiences must be a non-empty subset of: ${VALID_AUDIENCES.join(', ')}` },
      { status: 400 }
    );
  }

  const from = process.env.REBRAND_FROM || DEFAULT_REBRAND_FROM;
  const replyTo = process.env.REBRAND_REPLY_TO || DEFAULT_REBRAND_REPLY_TO;
  if (!from || from.includes('onboarding@resend.dev')) {
    return NextResponse.json(
      { error: 'REBRAND_FROM is not configured with a verified sender address' },
      { status: 500 }
    );
  }
  if (!from.includes(EXPECTED_SENDER_DOMAIN)) {
    return NextResponse.json(
      {
        error: `Rename email must send from the warmed ${EXPECTED_SENDER_DOMAIN} domain, not "${from}"`,
      },
      { status: 500 }
    );
  }

  const postalAddress = process.env.COMPANY_POSTAL_ADDRESS;

  const wantsDryRun = body.dryRun === true;
  const wantsRealSend = body.confirm === true;
  const wantsTest = body.testEmail !== undefined;

  // Ambiguous intent: a broadcast AND a single test in one call would silently
  // send only the test and skip the broadcast. Refuse so a stale testEmail left
  // in a confirm payload can't be mistaken for a completed blast.
  if (wantsRealSend && wantsTest) {
    return NextResponse.json({ error: 'Pass either testEmail or confirm, not both.' }, { status: 400 });
  }

  // Dry run is the default AND a hard override: an explicit dryRun:true forces
  // the count-only path even when confirm/testEmail are also set, so a stale
  // confirm in a reused request body can never turn a preview into a live send.
  // Counts render no mail, so they need neither the env guard nor the postal address.
  if (wantsDryRun || (!wantsRealSend && !wantsTest)) {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const audience of audiences) {
      const count = await getAudienceCount(audience);
      counts[audience] = count;
      total += count;
    }
    return NextResponse.json({ dryRun: true, audiences: counts, total });
  }

  // Every live send — a single test OR the full broadcast — is gated on the
  // environment guard, so nothing can fire from CI, a preview, or a dev shell.
  if (!realSendAllowed()) {
    return NextResponse.json(
      { error: 'Live send refused. Requires NODE_ENV=production and ALLOW_REAL_SEND=1.' },
      { status: 403 }
    );
  }

  // Any rendered email needs the CAN-SPAM postal address.
  if (!postalAddress || !postalAddress.trim()) {
    return NextResponse.json(
      { error: 'COMPANY_POSTAL_ADDRESS must be set (CAN-SPAM requires a physical mailing address)' },
      { status: 500 }
    );
  }

  const getHtml = (params: { email: string; firstName?: string; unsubscribeUrl: string }) =>
    getRebrandAnnouncementHtml({
      firstName: params.firstName,
      unsubscribeUrl: params.unsubscribeUrl,
      postalAddress,
    });

  if (wantsTest) {
    if (typeof body.testEmail !== 'string' || !body.testEmail.trim()) {
      return NextResponse.json({ error: 'testEmail must be a non-empty string' }, { status: 400 });
    }
    const result = await sendBroadcast({
      audience: audiences[0],
      subject: REBRAND_ANNOUNCEMENT_SUBJECT,
      from,
      replyTo,
      testEmail: body.testEmail,
      getHtml,
    });
    return NextResponse.json({ testEmail: body.testEmail, sent: result.sent, failed: result.failed });
  }

  const supabase = createAdminClient();
  const claim = await claimCampaignMarker(supabase, audiences, body.force === true);
  if (claim === 'already-sent') {
    return NextResponse.json(
      {
        error: `Campaign "${REBRAND_CAMPAIGN}" has already been sent. Inspect Resend first, then retry with force: true scoped to any failed audiences.`,
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

    for (const audience of audiences) {
      try {
        const result = await sendBroadcast({
          audience,
          subject: REBRAND_ANNOUNCEMENT_SUBJECT,
          from,
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
        loggerService.error('Rebrand announcement audience send failed', audienceError, {
          category: LogCategory.EMAIL,
          action: 'rebrand_email_audience_failed',
          metadata: { campaign: REBRAND_CAMPAIGN, audience },
        });
      }
    }

    const totals = results.reduce(
      (acc, r) => ({ total: acc.total + r.total, sent: acc.sent + r.sent, failed: acc.failed + r.failed }),
      { total: 0, sent: 0, failed: 0 }
    );

    const { error: updateError } = await supabase
      .from('campaign_sends')
      .update({ recipient_count: totals.sent })
      .eq('campaign', REBRAND_CAMPAIGN);
    if (updateError) {
      loggerService.error('Failed to persist rebrand recipient_count', updateError, {
        category: LogCategory.EMAIL,
        action: 'rebrand_email_marker_update_failed',
        metadata: { campaign: REBRAND_CAMPAIGN, sent: totals.sent },
      });
    }

    await captureServerEvent('rebrand_broadcast', 'email_broadcast_sent', {
      campaign: REBRAND_CAMPAIGN,
      dryRun: false,
      ...totals,
    });

    loggerService.info('Rebrand announcement broadcast complete', {
      category: LogCategory.BUSINESS,
      action: 'rebrand_email_broadcast_complete',
      metadata: { campaign: REBRAND_CAMPAIGN, ...totals },
    });

    return NextResponse.json({ audiences: results, failedAudiences, ...totals });
  } catch (error) {
    loggerService.error('Rebrand announcement broadcast failed', error, {
      category: LogCategory.EMAIL,
      action: 'rebrand_email_broadcast_failed',
      metadata: { campaign: REBRAND_CAMPAIGN },
    });
    return NextResponse.json(
      { error: 'Broadcast failed after the campaign marker was written. Inspect Resend before retrying with force: true.' },
      { status: 500 }
    );
  }
}
