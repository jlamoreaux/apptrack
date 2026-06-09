import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { getUnsubscribeUrl } from '@/lib/email/drip-scheduler';
import { canSendCategory } from '@/lib/email/preferences';
import { findStaleApplicationGroups } from '@/lib/email/stale-reminders';
import { staleReminderTemplate } from '@/lib/email/templates/lifecycle';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

/**
 * Stale Application Reminders Cron (retention Phase 2b)
 *
 * Runs daily. Sends at most one consolidated reminder per user listing all
 * applications with no status update in STALE_THRESHOLD_DAYS days. The daily
 * cadence is the dedup mechanism (these are not scheduled through drip_emails).
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    loggerService.logSecurityEvent(
      'cron_unauthorized_access',
      'high',
      { endpoint: '/api/cron/stale-reminders', providedAuth: authHeader ? 'present' : 'missing' },
      {}
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await findStaleApplicationGroups();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const group of groups) {
      try {
        if (!(await canSendCategory(group.userId, group.email, 'reminders'))) {
          skipped++;
          continue;
        }

        const html = staleReminderTemplate({
          firstName: group.firstName,
          email: group.email,
          unsubscribeUrl: getUnsubscribeUrl(group.email),
          jobs: group.jobs,
        });

        const result = await sendEmail({
          to: group.email,
          subject:
            group.jobs.length === 1
              ? `Still waiting on ${group.jobs[0].company}?`
              : `${group.jobs.length} applications need a status update`,
          html,
        });

        if (result.success) {
          sent++;
          captureServerEvent(group.userId, 'email_sent', {
            type: 'stale_reminder',
            stale_count: group.jobs.length,
          });
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        loggerService.error('Failed to send stale reminder', error, {
          category: LogCategory.EMAIL,
          action: 'stale_reminder_send_failed',
          metadata: { userId: group.userId },
        });
      }
    }

    loggerService.info('Stale reminders cron completed', {
      category: LogCategory.BUSINESS,
      action: 'stale_reminders_completed',
      duration: Date.now() - startTime,
      metadata: { groups: groups.length, sent, skipped, failed },
    });

    return NextResponse.json({ success: true, groups: groups.length, sent, skipped, failed });
  } catch (error) {
    loggerService.error('Error processing stale reminders', error, {
      category: LogCategory.API,
      action: 'stale_reminders_cron_error',
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Failed to process stale reminders' }, { status: 500 });
  }
}
