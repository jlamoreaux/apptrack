/**
 * Transactional Email Helpers
 *
 * One-off emails tied to specific user actions (not drip sequences).
 * Each email sends once per event — no deduplication, no DB tracking.
 * Use Resend's dashboard for delivery logs.
 */

import { sendEmail } from './client';
import { getUnsubscribeUrl } from './drip-scheduler';
import {
  wrapEmail,
  ctaButton,
  escapeHtml,
  safeUrl,
  EMAIL_THEME,
} from './templates/shared';

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://www.apptrack.ing';

export { escapeHtml, safeUrl };

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
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">
      ${safeName ? `Hi ${safeName},` : 'Hi there,'}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      Your resume roast is ready. See what our AI had to say.
    </p>
    ${ctaButton('View Your Roast', roastUrl)}
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      Want to take your job search further? AppTrack helps you track applications,
      prep for interviews, and analyze job fit — all in one place.
    </p>
    ${ctaButton('Try AppTrack Free', `${APP_URL}/signup`)}
  `,
    {
      unsubscribeUrl,
      footerNote: "You're receiving this because you used Resume Roast on AppTrack.",
    }
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
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>
    ${ctaButton('Reset Password', safeResetUrl)}
    <p style="margin: 0 0 16px; font-size: 14px; color: ${EMAIL_THEME.muted};">
      This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
    `,
    {
      unsubscribeUrl: getUnsubscribeUrl(email),
      footerNote:
        "You're receiving this because a password reset was requested for your AppTrack account.",
    }
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
      <div style="background: ${EMAIL_THEME.panelBg}; border: 1px solid ${EMAIL_THEME.border}; border-radius: 8px; padding: 20px; margin: 16px 0; font-family: Georgia, serif;">
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: ${EMAIL_THEME.heading}; white-space: pre-wrap;">${escapeHtml(text)}</p>
      </div>
    `;
  }

  if (featureType === 'job_fit') {
    const score = results?.fitScore || results?.overallScore || 0;
    const strengths = results?.strengths || [];
    const gaps = results?.gaps || [];
    const recommendation = results?.recommendation || '';

    let html = `
      <div style="background: ${EMAIL_THEME.panelBg}; border: 1px solid ${EMAIL_THEME.border}; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="margin: 0 0 12px; font-size: 24px; font-weight: bold; color: ${EMAIL_THEME.primary};">Match Score: ${score}%</p>
    `;
    if (strengths.length > 0) {
      html += `<p style="margin: 12px 0 4px; font-weight: 600; color: ${EMAIL_THEME.heading};">Strengths:</p><ul style="margin: 0; padding-left: 20px;">`;
      strengths.slice(0, 5).forEach((s: any) => {
        const text = typeof s === 'string' ? s : s?.point || s?.description || '';
        html += `<li style="margin: 4px 0; color: ${EMAIL_THEME.body};">${escapeHtml(text)}</li>`;
      });
      html += `</ul>`;
    }
    if (gaps.length > 0) {
      html += `<p style="margin: 12px 0 4px; font-weight: 600; color: ${EMAIL_THEME.heading};">Areas to improve:</p><ul style="margin: 0; padding-left: 20px;">`;
      gaps.slice(0, 3).forEach((g: any) => {
        const text = typeof g === 'string' ? g : g?.point || g?.description || '';
        html += `<li style="margin: 4px 0; color: ${EMAIL_THEME.body};">${escapeHtml(text)}</li>`;
      });
      html += `</ul>`;
    }
    if (recommendation) {
      html += `<p style="margin: 12px 0 0; color: ${EMAIL_THEME.body};"><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</p>`;
    }
    html += `</div>`;
    return html;
  }

  if (featureType === 'interview_prep') {
    const questions = results?.questions || [];
    let html = `<div style="background: ${EMAIL_THEME.panelBg}; border: 1px solid ${EMAIL_THEME.border}; border-radius: 8px; padding: 20px; margin: 16px 0;">`;
    questions.slice(0, 8).forEach((q: any, i: number) => {
      const text = typeof q === 'string' ? q : q?.question || q?.text || '';
      const type = q?.type || q?.category || '';
      html += `
        <p style="margin: ${i > 0 ? '16px' : '0'} 0 4px; font-weight: 600; color: ${EMAIL_THEME.heading};">${i + 1}. ${escapeHtml(text)}</p>
        ${type ? `<p style="margin: 0; font-size: 13px; color: ${EMAIL_THEME.muted};">${escapeHtml(type)}</p>` : ''}
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
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">
      ${safeName ? `Hi ${safeName},` : 'Hi there,'}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      Here are your ${label.toLowerCase()} results from AppTrack:
    </p>
    ${resultsHtml}
    <p style="margin: 16px 0; font-size: 16px; color: ${EMAIL_THEME.body};">
      Want to save these results and get unlimited AI coaching? Create a free account:
    </p>
    ${ctaButton('Create Free Account', `${APP_URL}/signup`)}
  `,
    {
      unsubscribeUrl,
      footerNote: "You're receiving this because you tried AppTrack's AI tools.",
    }
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
