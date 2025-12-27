import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import {
  getPendingDrips,
  markDripSent,
  markDripFailed,
  getUnsubscribeUrl,
  isUserSubscribed,
} from '@/lib/email/drip-scheduler';
import { getTemplateById } from '@/lib/email/templates/drip';
import { getAudienceMember } from '@/lib/email/audiences';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://apptrack.ing';

/**
 * Drip Emails Cron Job
 *
 * Processes pending drip emails and sends them via Resend.
 * Should be called by a cron job (e.g., Vercel Cron) every 4 hours.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Security: Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      loggerService.logSecurityEvent('cron_unauthorized_access', 'high', {
        endpoint: '/api/cron/drip-emails',
        providedAuth: authHeader ? 'present' : 'missing',
      }, {});
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending drips
    const pendingDrips = await getPendingDrips(100);

    if (pendingDrips.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const drip of pendingDrips) {
      try {
        // Check if user is still subscribed
        const subscribed = await isUserSubscribed(drip.email);
        if (!subscribed) {
          await markDripSent(drip.id); // Mark as sent to skip it
          skipped++;
          continue;
        }

        // Get the template
        const template = getTemplateById(drip.template_id);
        if (!template) {
          await markDripFailed(drip.id, `Template not found: ${drip.template_id}`);
          failed++;
          continue;
        }

        // Get audience member data for personalization
        const member = await getAudienceMember(drip.email);

        // Generate unsubscribe URL
        const unsubscribeUrl = getUnsubscribeUrl(drip.email);

        // Get roast URL if available (for leads from resume roast)
        const roastId = member?.metadata?.roastId || member?.metadata?.roast_id;
        const roastUrl = roastId ? `${APP_URL}/roast/${roastId}` : undefined;

        // Generate email HTML
        const html = template.getHtml({
          firstName: member?.first_name || undefined,
          email: drip.email,
          unsubscribeUrl,
          roastUrl,
        });

        // Send email
        const result = await sendEmail({
          to: drip.email,
          subject: template.subject,
          html,
        });

        if (result.success) {
          await markDripSent(drip.id);
          sent++;
        } else {
          await markDripFailed(drip.id, 'Email send failed');
          failed++;
        }
      } catch (error) {
        loggerService.error(`Failed to process drip email ${drip.id}`, error, {
          category: LogCategory.API,
          action: 'drip_email_error',
          metadata: {
            dripId: drip.id,
            templateId: drip.template_id,
            email: drip.email,
          },
        });

        await markDripFailed(drip.id, String(error));
        failed++;
      }
    }

    loggerService.info('Drip emails cron completed', {
      category: LogCategory.BUSINESS,
      action: 'drip_emails_completed',
      duration: Date.now() - startTime,
      metadata: {
        processed: pendingDrips.length,
        sent,
        skipped,
        failed,
      },
    });

    return NextResponse.json({
      success: true,
      processed: pendingDrips.length,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    loggerService.error('Error processing drip emails', error, {
      category: LogCategory.API,
      action: 'drip_emails_cron_error',
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Failed to process drip emails' },
      { status: 500 }
    );
  }
}
