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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET shows a confirmation page with an "Approve and Send" button.
 * This prevents mail scanners from triggering the broadcast.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get('id');
  const token = searchParams.get('token');

  if (!draftId || !token) {
    return htmlResponse('Missing parameters', '<p>The approval link is invalid.</p>', 400);
  }

  if (!verifyApproveToken(draftId, token)) {
    loggerService.logSecurityEvent('changelog_approve_invalid_token', 'high', {
      endpoint: '/api/admin/changelog/approve',
      draftId,
    }, {});
    return htmlResponse('Invalid token', '<p>The approval link is invalid or has expired.</p>', 403);
  }

  const draft = await getChangelogDraft(draftId);

  if (!draft) {
    return htmlResponse('Not found', '<p>This changelog draft was not found.</p>', 404);
  }

  if (draft.status === 'sent') {
    return htmlResponse(
      'Already sent',
      `<p>This changelog (week of ${escapeHtml(draft.week_of)}) was already sent.</p>`,
      200
    );
  }

  if (draft.status !== 'pending') {
    return htmlResponse(
      'Cannot send',
      `<p>This changelog has status &quot;${escapeHtml(draft.status)}&quot; and cannot be sent.</p>`,
      400
    );
  }

  // Show confirmation page with POST form
  const categoryList = draft.content.categories
    .map((c) => `<li>${escapeHtml(c.title)}: ${c.items.length} items</li>`)
    .join('');

  return htmlResponse(
    'Approve Changelog',
    `
      <p>Week of ${escapeHtml(draft.week_of)}</p>
      <ul>${categoryList}</ul>
      <p>Click below to broadcast to all subscribers.</p>
      <form method="POST" action="/api/admin/changelog/approve">
        <input type="hidden" name="id" value="${escapeHtml(draftId)}" />
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <button type="submit" style="padding: 14px 40px; background-color: #16a34a; color: #ffffff; border: none; cursor: pointer; font-weight: 600; border-radius: 6px; font-size: 16px;">Approve and Send</button>
      </form>
    `,
    200
  );
}

/**
 * POST actually triggers the broadcast.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const formData = await request.formData();
  const draftId = formData.get('id') as string | null;
  const token = formData.get('token') as string | null;

  if (!draftId || !token) {
    return htmlResponse('Missing parameters', '<p>The approval request is invalid.</p>', 400);
  }

  if (!verifyApproveToken(draftId, token)) {
    loggerService.logSecurityEvent('changelog_approve_invalid_token', 'high', {
      endpoint: '/api/admin/changelog/approve',
      draftId,
    }, {});
    return htmlResponse('Invalid token', '<p>The approval link is invalid or has expired.</p>', 403);
  }

  const draft = await getChangelogDraft(draftId);

  if (!draft) {
    return htmlResponse('Not found', '<p>This changelog draft was not found.</p>', 404);
  }

  if (draft.status === 'sent') {
    return htmlResponse(
      'Already sent',
      `<p>This changelog (week of ${escapeHtml(draft.week_of)}) was already sent.</p>`,
      200
    );
  }

  if (draft.status !== 'pending') {
    return htmlResponse(
      'Cannot send',
      `<p>This changelog has status &quot;${escapeHtml(draft.status)}&quot; and cannot be sent.</p>`,
      400
    );
  }

  try {
    // Optimistic lock: only proceeds if status was actually changed from pending
    const approved = await markDraftApproved(draftId);
    if (!approved) {
      return htmlResponse(
        'Already processing',
        '<p>This changelog is already being processed by another request.</p>',
        409
      );
    }

    // Broadcast to all audiences
    const results = await broadcastChangelog({
      changelog: draft.content,
      audiences: BROADCAST_AUDIENCES,
    });

    // Mark as sent — log but don't fail if this doesn't work
    const sentMarked = await markDraftSent(draftId, results);
    if (!sentMarked) {
      loggerService.warn('Failed to mark draft as sent after successful broadcast', {
        category: LogCategory.API,
        action: 'changelog_mark_sent_failed',
        metadata: { draftId },
      });
    }

    loggerService.info('Changelog approved and broadcast', {
      category: LogCategory.BUSINESS,
      action: 'changelog_approved_and_sent',
      duration: Date.now() - startTime,
      metadata: { draftId, ...results },
    });

    const statsHtml = results.audiences
      .map(
        (r) =>
          `<li>${escapeHtml(r.audience)}: ${r.sent} sent, ${r.failed} failed (${r.total} total)</li>`
      )
      .join('');

    return htmlResponse(
      'Changelog sent!',
      `
        <p>Week of ${escapeHtml(draft.week_of)} changelog has been broadcast.</p>
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
      '<p>An error occurred while sending the changelog. Check the logs for details.</p>',
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
  <title>${escapeHtml(title)} - AppTrack Changelog</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; color: #18181b; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p, li { font-size: 16px; color: #3f3f46; line-height: 1.6; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}
