import { NextRequest, NextResponse } from 'next/server';
import { getUnsubscribeUrl } from '@/lib/email/drip-scheduler';
import { verifyCronAuth, runLifecycleSend } from '@/lib/email/lifecycle-cron';
import { findDigestGroups, generateDigestInsight } from '@/lib/email/weekly-digest';
import { weeklyDigestTemplate } from '@/lib/email/templates/lifecycle';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

// One email per active user, each with an LLM insight call; allow the full
// Fluid Compute window so the run scales with the user base.
export const maxDuration = 300;

/**
 * Weekly Pipeline Digest Cron (retention Phase 2c)
 *
 * Runs Monday morning. One digest per user with active applications, including
 * a one-line AI Coach insight. Distinct from the product changelog cron.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!verifyCronAuth(request, '/api/cron/weekly-digest')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await findDigestGroups();

    const counters = await runLifecycleSend({
      groups,
      category: 'digest',
      buildEmail: async (group) => {
        const insight = await generateDigestInsight(group);
        return {
          subject: 'Your weekly pipeline review',
          html: weeklyDigestTemplate({
            firstName: group.firstName,
            email: group.email,
            unsubscribeUrl: getUnsubscribeUrl(group.email, 'digest'),
            activeCount: group.summary.activeCount,
            needsFollowUp: group.summary.needsFollowUp,
            newThisWeek: group.summary.newThisWeek,
            insight,
          }),
        };
      },
      onSent: (group) => {
        captureServerEvent(group.userId, 'email_sent', {
          type: 'weekly_digest',
          active_count: group.summary.activeCount,
        });
      },
      onError: (group, error) => {
        loggerService.error('Failed to send weekly digest', error, {
          category: LogCategory.EMAIL,
          action: 'weekly_digest_send_failed',
          metadata: { userId: group.userId },
        });
      },
    });

    loggerService.info('Weekly digest cron completed', {
      category: LogCategory.BUSINESS,
      action: 'weekly_digest_completed',
      duration: Date.now() - startTime,
      metadata: { groups: groups.length, ...counters },
    });

    return NextResponse.json({ success: true, groups: groups.length, ...counters });
  } catch (error) {
    loggerService.error('Error processing weekly digest', error, {
      category: LogCategory.API,
      action: 'weekly_digest_cron_error',
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Failed to process weekly digest' }, { status: 500 });
  }
}
