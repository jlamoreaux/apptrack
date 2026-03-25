import { NextRequest, NextResponse } from 'next/server';
import {
  getChangelogDraft,
  markDraftApproved,
  markDraftSent,
  verifyApproveToken,
} from '@/lib/email/changelog-generator';
import { broadcastChangelog } from '@/lib/email/broadcast';
import type { AudienceId } from '@/lib/email/audiences';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const BROADCAST_AUDIENCES: AudienceId[] = ['free-users', 'trial-users', 'paid-users'];

/**
 * Approve and Send Changelog
 *
 * GET /api/admin/changelog/approve?id=<draftId>&token=<hmac>
 *
 * Validates the HMAC token, reads the draft, broadcasts to all audiences,
 * and returns an HTML confirmation page.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get('id');
  const token = searchParams.get('token');

  // Validate params
  if (!draftId || !token) {
    return htmlResponse('Missing parameters', 'The approval link is invalid.', 400);
  }

  // Verify HMAC token
  try {
    if (!verifyApproveToken(draftId, token)) {
      loggerService.logSecurityEvent('changelog_approve_invalid_token', 'high', {
        endpoint: '/api/admin/changelog/approve',
        draftId,
      }, {});
      return htmlResponse('Invalid token', 'The approval link is invalid or has expired.', 403);
    }
  } catch {
    return htmlResponse('Verification error', 'Could not verify the approval token.', 500);
  }

  // Get the draft
  const draft = await getChangelogDraft(draftId);

  if (!draft) {
    return htmlResponse('Not found', 'This changelog draft was not found.', 404);
  }

  if (draft.status === 'sent') {
    return htmlResponse(
      'Already sent',
      `This changelog (week of ${draft.week_of}) was already sent.`,
      200
    );
  }

  if (draft.status !== 'pending') {
    return htmlResponse(
      'Cannot send',
      `This changelog has status "${draft.status}" and cannot be sent.`,
      400
    );
  }

  try {
    // Mark as approved
    await markDraftApproved(draftId);

    // Broadcast to all audiences
    const results = await broadcastChangelog({
      changelog: draft.content,
      audiences: BROADCAST_AUDIENCES,
    });

    // Mark as sent
    await markDraftSent(draftId, results);

    loggerService.info('Changelog approved and broadcast', {
      category: LogCategory.BUSINESS,
      action: 'changelog_approved_and_sent',
      duration: Date.now() - startTime,
      metadata: { draftId, ...results },
    });

    const statsHtml = results.audiences
      .map(
        (r) =>
          `<li>${r.audience}: ${r.sent} sent, ${r.failed} failed (${r.total} total)</li>`
      )
      .join('');

    return htmlResponse(
      'Changelog sent!',
      `
        <p>Week of ${draft.week_of} changelog has been broadcast.</p>
        <ul>${statsHtml}</ul>
        <p><strong>Total:</strong> ${results.sent} sent, ${results.failed} failed</p>
      `,
      200
    );
  } catch (error) {
    loggerService.error('Error broadcasting approved changelog', error, {
      category: LogCategory.API,
      action: 'changelog_approve_broadcast_error',
      duration: Date.now() - startTime,
      metadata: { draftId },
    });

    return htmlResponse(
      'Send failed',
      'An error occurred while sending the changelog. Check the logs for details.',
      500
    );
  }
}

function htmlResponse(title: string, body: string, status: number): NextResponse {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AppTrack Changelog</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; color: #18181b; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p, li { font-size: 16px; color: #3f3f46; line-height: 1.6; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}
