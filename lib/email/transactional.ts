/**
 * Transactional Email Helpers
 *
 * One-off emails tied to specific user actions (not drip sequences).
 * Each email sends once per event — no deduplication, no DB tracking.
 * Use Resend's dashboard for delivery logs.
 */

import { sendEmail } from './client';
import { getUnsubscribeUrl } from './drip-scheduler';

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://www.apptrack.ing';

/** Escape special HTML characters to prevent XSS via user-controlled strings. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate and return a safe URL for use in href attributes.
 * Only allows http/https schemes; falls back to '#' for anything else.
 */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    // invalid URL
  }
  return '#';
}

function wrapEmail(content: string, unsubscribeUrl: string): string {
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AppTrack</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">AppTrack</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #71717a; text-align: center;">
                You're receiving this because you used Resume Roast on AppTrack.
              </p>
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                <a href="${safeUnsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  const safeHref = safeUrl(url);
  const safeText = escapeHtml(text);
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${safeHref}" style="display: inline-block; padding: 12px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 500; border-radius: 6px;">${safeText}</a>
    </td>
  </tr>
</table>`;
}

export type SendRoastReadyEmailOptions = {
  email: string;
  firstName?: string;
  roastId: string;
};

/**
 * Send the "Your Roast is Ready" email.
 * Fires once per roast submission — no deduplication by design.
 */
export async function sendRoastReadyEmail({
  email,
  firstName,
  roastId,
}: SendRoastReadyEmailOptions): Promise<{ success: boolean }> {
  const roastUrl = `${APP_URL}/roast/${roastId}`;
  const unsubscribeUrl = getUnsubscribeUrl(email);

  const safeName = firstName ? escapeHtml(firstName) : undefined;

  const html = wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
      ${safeName ? `Hi ${safeName},` : 'Hi there,'}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
      Your resume roast is ready. See what our AI had to say.
    </p>
    ${ctaButton('View Your Roast', roastUrl)}
    <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
      Want to take your job search further? AppTrack helps you track applications,
      prep for interviews, and analyze job fit — all in one place.
    </p>
    ${ctaButton('Try AppTrack Free', `${APP_URL}/signup`)}
  `,
    unsubscribeUrl
  );

  try {
    const result = await sendEmail({
      to: email,
      subject: 'Your Resume Roast is Ready',
      html,
    });
    return { success: result.success };
  } catch (err) {
    // Caller handles logging — just return failure
    return { success: false };
  }
}

// ─── Password Reset Email ────────────────────────────────────

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}): Promise<{ success: boolean }> {
  const safeResetUrl = safeUrl(resetUrl);

  const html = wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>
    ${ctaButton('Reset Password', safeResetUrl)}
    <p style="margin: 0 0 16px; font-size: 14px; color: #71717a;">
      This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
    `,
    getUnsubscribeUrl(email)
  );

  try {
    const result = await sendEmail({
      to: email,
      subject: 'Reset your AppTrack password',
      html,
    });
    return { success: result.success };
  } catch {
    return { success: false };
  }
}

// ─── Try Results Email ───────────────────────────────────────

interface SendTryResultsEmailOptions {
  email: string;
  firstName?: string;
  featureType: string;
  results: any;
}

function formatResultsForEmail(featureType: string, results: any): string {
  if (featureType === 'cover_letter') {
    const text = typeof results === 'string' ? results : results?.text || '';
    return `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; font-family: Georgia, serif;">
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #1f2937; white-space: pre-wrap;">${escapeHtml(text)}</p>
      </div>
    `;
  }

  if (featureType === 'job_fit') {
    const score = results?.fitScore || results?.overallScore || 0;
    const strengths = results?.strengths || [];
    const gaps = results?.gaps || [];
    const recommendation = results?.recommendation || '';

    let html = `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="margin: 0 0 12px; font-size: 24px; font-weight: bold; color: #4338ca;">Match Score: ${score}%</p>
    `;
    if (strengths.length > 0) {
      html += `<p style="margin: 12px 0 4px; font-weight: 600; color: #1f2937;">Strengths:</p><ul style="margin: 0; padding-left: 20px;">`;
      strengths.slice(0, 5).forEach((s: any) => {
        const text = typeof s === 'string' ? s : s?.point || s?.description || '';
        html += `<li style="margin: 4px 0; color: #3f3f46;">${escapeHtml(text)}</li>`;
      });
      html += `</ul>`;
    }
    if (gaps.length > 0) {
      html += `<p style="margin: 12px 0 4px; font-weight: 600; color: #1f2937;">Areas to improve:</p><ul style="margin: 0; padding-left: 20px;">`;
      gaps.slice(0, 3).forEach((g: any) => {
        const text = typeof g === 'string' ? g : g?.point || g?.description || '';
        html += `<li style="margin: 4px 0; color: #3f3f46;">${escapeHtml(text)}</li>`;
      });
      html += `</ul>`;
    }
    if (recommendation) {
      html += `<p style="margin: 12px 0 0; color: #3f3f46;"><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</p>`;
    }
    html += `</div>`;
    return html;
  }

  if (featureType === 'interview_prep') {
    const questions = results?.questions || [];
    let html = `<div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0;">`;
    questions.slice(0, 8).forEach((q: any, i: number) => {
      const text = typeof q === 'string' ? q : q?.question || q?.text || '';
      const type = q?.type || q?.category || '';
      html += `
        <p style="margin: ${i > 0 ? '16px' : '0'} 0 4px; font-weight: 600; color: #1f2937;">${i + 1}. ${escapeHtml(text)}</p>
        ${type ? `<p style="margin: 0; font-size: 13px; color: #6b7280;">${escapeHtml(type)}</p>` : ''}
      `;
    });
    html += `</div>`;
    return html;
  }

  return '';
}

const FEATURE_LABELS: Record<string, string> = {
  cover_letter: 'Cover Letter',
  job_fit: 'Job Fit Analysis',
  interview_prep: 'Interview Questions',
};

export async function sendTryResultsEmail({
  email,
  firstName,
  featureType,
  results,
}: SendTryResultsEmailOptions): Promise<{ success: boolean }> {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const safeName = firstName ? escapeHtml(firstName) : undefined;
  const label = FEATURE_LABELS[featureType] || 'AI Analysis';

  const resultsHtml = formatResultsForEmail(featureType, results);

  const html = wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
      ${safeName ? `Hi ${safeName},` : 'Hi there,'}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
      Here are your ${label.toLowerCase()} results from AppTrack:
    </p>
    ${resultsHtml}
    <p style="margin: 16px 0; font-size: 16px; color: #3f3f46;">
      Want to save these results and get unlimited AI coaching? Create a free account:
    </p>
    ${ctaButton('Create Free Account', `${APP_URL}/signup`)}
  `,
    unsubscribeUrl
  );

  try {
    const result = await sendEmail({
      to: email,
      subject: `Your ${label} from AppTrack`,
      html,
    });
    return { success: result.success };
  } catch (err) {
    return { success: false };
  }
}
