/**
 * Career Companion Validation Email (Phase 0)
 *
 * Copy approved by the owner 2026-07-10. Sent once, manually, via
 * POST /api/admin/career-validation-email (owner-triggered, not scheduled).
 */

import { CAREER_CAMPAIGN } from '@/lib/constants/career';
import { generateWaitlistToken } from '@/lib/career/waitlist-token';
import { APP_URL, ctaButton, escapeHtml, EMAIL_THEME, wrapEmail } from './shared';

export const CAREER_VALIDATION_SUBJECT = "Let's build a case for your next raise.";

export const CAREER_VALIDATION_CTA_URL = `${APP_URL}/career?utm_source=email&utm_medium=email&utm_campaign=${CAREER_CAMPAIGN}`;

/**
 * Per-recipient CTA: appends a signed token so clicking joins the recipient in
 * one click (no form) without a raw email in the URL. Falls back to the plain
 * form URL when the email is unknown.
 */
export function careerValidationCtaUrl(email?: string): string {
  if (!email) {
    return CAREER_VALIDATION_CTA_URL;
  }
  return `${CAREER_VALIDATION_CTA_URL}&t=${encodeURIComponent(generateWaitlistToken(email))}`;
}

// Sent personally from the founder so it reads as a direct note, not a
// company blast, with replies routed to a real inbox. The route resolves
// these against CAREER_VALIDATION_FROM / CAREER_VALIDATION_REPLY_TO env vars
// at request time. The address MUST be a verified Resend sender — confirm
// before sending.
export const DEFAULT_CAREER_VALIDATION_FROM = 'Jordan at AppTrack <jordan@apptrack.ing>';
export const DEFAULT_CAREER_VALIDATION_REPLY_TO = 'jordan@apptrack.ing';

export type CareerValidationTemplateParams = {
  firstName?: string;
  /** Recipient email — signs the one-click join token on the CTA. */
  email?: string;
  unsubscribeUrl: string;
};

export function getCareerValidationHtml(params: CareerValidationTemplateParams): string {
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : 'Hi there,';
  const ctaUrl = careerValidationCtaUrl(params.email);

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">
      ${greeting}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      I'm Jordan, the founder of AppTrack.
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      I'm building a career companion for your next raise or promotion: track
      your wins as they happen, turn them into a clear, evidence-backed case when
      review time comes, and know your gaps before your manager does.
    </p>
    <p style="margin: 0 0 8px; font-size: 16px; color: ${EMAIL_THEME.body};">
      It's early and still coming together, and I want to build it with the
      people it's for. Want in?
    </p>
    ${ctaButton('Join the waitlist', ctaUrl)}
    <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_THEME.muted}; text-align: center;">
      Just reply if you have questions. I read every one.
    </p>`;

  return wrapEmail(content, params);
}
