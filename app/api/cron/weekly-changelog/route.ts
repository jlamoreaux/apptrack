import { NextRequest, NextResponse } from 'next/server';
import { broadcastChangelog, getAudienceCount } from '@/lib/email/broadcast';
import type { ChangelogData } from '@/lib/email/templates/changelog';
import type { AudienceId } from '@/lib/email/audiences';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const ALLOWED_AUDIENCES: AudienceId[] = ['free-users', 'trial-users', 'paid-users'];

type RequestBody = {
  changelog: ChangelogData;
  audiences?: AudienceId[];
  dryRun?: boolean;
  testEmail?: string;
};

/**
 * Weekly Changelog Broadcast
 *
 * POST /api/cron/weekly-changelog
 * Authorization: Bearer <CRON_SECRET>
 *
 * Body:
 *   changelog: { weekOf, categories }
 *   audiences?: which segments to send to (default: all)
 *   dryRun?: true to get counts without sending
 *   testEmail?: send to a single email for testing
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify auth — fail closed if CRON_SECRET is not configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      loggerService.logSecurityEvent('cron_unauthorized_access', 'high', {
        endpoint: '/api/cron/weekly-changelog',
        providedAuth: authHeader ? 'present' : 'missing',
      }, {});
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const { changelog, dryRun, testEmail } = body;

    if (!changelog?.weekOf || !changelog?.categories?.length) {
      return NextResponse.json({ error: 'Invalid changelog data' }, { status: 400 });
    }

    const audiences = (body.audiences || ALLOWED_AUDIENCES).filter((a) =>
      ALLOWED_AUDIENCES.includes(a)
    );

    // Dry run: return audience counts
    if (dryRun) {
      const counts: Record<string, number> = {};
      for (const audience of audiences) {
        counts[audience] = await getAudienceCount(audience);
      }
      return NextResponse.json({ dryRun: true, audiences: counts });
    }

    // Send broadcasts
    const results = await broadcastChangelog({ changelog, audiences, testEmail });

    loggerService.info('Weekly changelog broadcast complete', {
      category: LogCategory.BUSINESS,
      action: 'changelog_broadcast_complete',
      duration: Date.now() - startTime,
      metadata: results,
    });

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    loggerService.error('Error sending weekly changelog', error, {
      category: LogCategory.API,
      action: 'changelog_broadcast_error',
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Failed to send changelog broadcast' },
      { status: 500 }
    );
  }
}
