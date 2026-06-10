import { NextRequest, NextResponse } from 'next/server';
import { getUnsubscribeUrl } from '@/lib/email/drip-scheduler';
import { verifyCronAuth, runLifecycleSend } from '@/lib/email/lifecycle-cron';
import { findStaleApplicationGroups } from '@/lib/email/stale-reminders';
import { staleReminderTemplate } from '@/lib/email/templates/lifecycle';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

// One email per user with stale applications; runtime grows with the user
// base, so allow the full Fluid Compute window.
export const maxDuration = 300;

/**
 * Stale Application Reminders Cron (retention Phase 2b)
 *
 * Runs daily. Sends at most one consolidated reminder per user listing all
 * applications with no status update in STALE_THRESHOLD_DAYS days. The daily
 * cadence is the dedup mechanism (these are not scheduled through drip_emails).
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!verifyCronAuth(request, '/api/cron/stale-reminders')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await findStaleApplicationGroups();

    const counters = await runLifecycleSend({
      groups,
      category: 'reminders',
      buildEmail: (group) => ({
        subject:
          group.jobs.length === 1
            ? `Still waiting on ${group.jobs[0].company}?`
            : `${group.jobs.length} applications need a status update`,
        html: staleReminderTemplate({
          firstName: group.firstName,
          email: group.email,
          unsubscribeUrl: getUnsubscribeUrl(group.email, 'reminders'),
          jobs: group.jobs,
        }),
      }),
      onSent: (group) => {
        captureServerEvent(group.userId, 'email_sent', {
          type: 'stale_reminder',
          stale_count: group.jobs.length,
        });
      },
      onError: (group, error) => {
        loggerService.error('Failed to send stale reminder', error, {
          category: LogCategory.EMAIL,
          action: 'stale_reminder_send_failed',
          metadata: { userId: group.userId },
        });
      },
    });

    loggerService.info('Stale reminders cron completed', {
      category: LogCategory.BUSINESS,
      action: 'stale_reminders_completed',
      duration: Date.now() - startTime,
      metadata: { groups: groups.length, ...counters },
    });

    return NextResponse.json({ success: true, groups: groups.length, ...counters });
  } catch (error) {
    loggerService.error('Error processing stale reminders', error, {
      category: LogCategory.API,
      action: 'stale_reminders_cron_error',
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Failed to process stale reminders' }, { status: 500 });
  }
}
