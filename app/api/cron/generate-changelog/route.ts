import { NextRequest, NextResponse } from 'next/server';
import {
  fetchRecentCommits,
  generateChangelogDraft,
  saveChangelogDraft,
  generateApproveToken,
} from '@/lib/email/changelog-generator';
import { getChangelogHtml, getCtaForAudience } from '@/lib/email/templates/changelog';
import { sendEmail } from '@/lib/email/client';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.apptrack.ing';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate Weekly Changelog Cron
 *
 * GET /api/cron/generate-changelog
 * Authorization: Bearer <CRON_SECRET>
 *
 * Fetches commits from the past week, generates a customer-friendly changelog
 * using AI, saves the draft, and emails the admin for approval.
 */
export async function GET(request: NextRequest) {
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
        endpoint: '/api/cron/generate-changelog',
        providedAuth: authHeader ? 'present' : 'missing',
      }, {});
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch recent commits
    const commits = await fetchRecentCommits(7);

    if (commits.length === 0) {
      return NextResponse.json({ success: true, message: 'No commits in the past week' });
    }

    // 2. Generate changelog draft using AI
    const changelog = await generateChangelogDraft(commits);

    // 3. Save draft to database
    const draftId = await saveChangelogDraft(changelog);

    // 4. Email admin for approval
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      loggerService.warn('ADMIN_EMAIL not configured, changelog draft saved but no notification sent', {
        category: LogCategory.EMAIL,
        action: 'changelog_no_admin_email',
        metadata: { draftId },
      });
      return NextResponse.json({
        success: true,
        draftId,
        message: 'Draft saved but ADMIN_EMAIL not configured',
      });
    }

    // Generate approve URL with HMAC token
    const token = generateApproveToken(draftId);
    const approveUrl = `${APP_URL}/api/admin/changelog/approve?id=${draftId}&token=${token}`;

    // Render the changelog preview for the admin email
    const { ctaText, ctaUrl } = getCtaForAudience('free-users');
    const changelogPreview = getChangelogHtml({
      email: adminEmail,
      unsubscribeUrl: '#',
      changelog,
      ctaText,
      ctaUrl,
    });

    // Build admin notification email
    const adminHtml = buildAdminNotificationEmail(changelog, changelogPreview, approveUrl, draftId, commits.length);

    await sendEmail({
      to: adminEmail,
      subject: `Changelog Draft Ready -- Week of ${changelog.weekOf}`,
      html: adminHtml,
    });

    loggerService.info('Changelog draft generated and admin notified', {
      category: LogCategory.BUSINESS,
      action: 'changelog_draft_generated',
      duration: Date.now() - startTime,
      metadata: { draftId, commitCount: commits.length, categoryCount: changelog.categories.length },
    });

    return NextResponse.json({
      success: true,
      draftId,
      commitCount: commits.length,
      changelog,
    });
  } catch (error) {
    loggerService.error('Error generating changelog', error, {
      category: LogCategory.API,
      action: 'changelog_generate_error',
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Failed to generate changelog' },
      { status: 500 }
    );
  }
}

function buildAdminNotificationEmail(
  changelog: { weekOf: string; categories: { title: string; items: string[] }[] },
  changelogPreview: string,
  approveUrl: string,
  draftId: string,
  commitCount: number,
): string {
  const categorySummary = changelog.categories
    .map((c) => `${escapeHtml(c.title)}: ${c.items.length} items`)
    .join(', ');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Weekly Changelog Draft</h1>
              <p style="margin: 0 0 8px; font-size: 14px; color: #3f3f46;">
                Week of ${escapeHtml(changelog.weekOf)} | ${commitCount} commits | ${categorySummary}
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #3f3f46;">
                Draft ID: <code>${draftId}</code>
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">
                Review the changelog below. Click approve to broadcast to all subscribers.
              </p>

              <!-- Approve Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${approveUrl}" style="display: inline-block; padding: 14px 40px; background-color: #16a34a; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 16px;">Approve and Send</a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border: none; border-top: 2px solid #e4e4e7; margin: 0 0 24px;">

              <!-- Preview Label -->
              <p style="margin: 0 0 16px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">
                Email Preview (free user version)
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 16px 32px;">
              <!-- Embedded preview -->
              <div style="border: 1px solid #e4e4e7; border-radius: 6px; overflow: hidden;">
                ${changelogPreview}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
