import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { getUnsubscribeUrl } from '@/lib/email/drip-scheduler';
import { canSendCategory } from '@/lib/email/preferences';
import { findDigestGroups, generateDigestInsight } from '@/lib/email/weekly-digest';
import { weeklyDigestTemplate } from '@/lib/email/templates/lifecycle';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

/**
 * Weekly Pipeline Digest Cron (retention Phase 2c)
 *
 * Runs Monday morning. One digest per user with active applications, including
 * a one-line AI Coach insight. Distinct from the product changelog cron.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    loggerService.logSecurityEvent(
      'cron_unauthorized_access',
      'high',
      { endpoint: '/api/cron/weekly-digest', providedAuth: authHeader ? 'present' : 'missing' },
      {}
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await findDigestGroups();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const group of groups) {
      try {
        if (!(await canSendCategory(group.userId, group.email, 'digest'))) {
          skipped++;
          continue;
        }

        const insight = await generateDigestInsight(group);

        const html = weeklyDigestTemplate({
          firstName: group.firstName,
          email: group.email,
          unsubscribeUrl: getUnsubscribeUrl(group.email),
          activeCount: group.summary.activeCount,
          needsFollowUp: group.summary.needsFollowUp,
          newThisWeek: group.summary.newThisWeek,
          insight,
        });

        const result = await sendEmail({
          to: group.email,
          subject: 'Your weekly pipeline review',
          html,
        });

        if (result.success) {
          sent++;
          captureServerEvent(group.userId, 'email_sent', {
            type: 'weekly_digest',
            active_count: group.summary.activeCount,
          });
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        loggerService.error('Failed to send weekly digest', error, {
          category: LogCategory.EMAIL,
          action: 'weekly_digest_send_failed',
          metadata: { userId: group.userId },
        });
      }
    }

    loggerService.info('Weekly digest cron completed', {
      category: LogCategory.BUSINESS,
      action: 'weekly_digest_completed',
      duration: Date.now() - startTime,
      metadata: { groups: groups.length, sent, skipped, failed },
    });

    return NextResponse.json({ success: true, groups: groups.length, sent, skipped, failed });
  } catch (error) {
    loggerService.error('Error processing weekly digest', error, {
      category: LogCategory.API,
      action: 'weekly_digest_cron_error',
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Failed to process weekly digest' }, { status: 500 });
  }
}
