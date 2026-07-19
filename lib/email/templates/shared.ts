/**
 * Shared Email Template Components
 *
 * Reusable HTML builders for all email templates (drip, changelog, lifecycle,
 * transactional). EMAIL_THEME mirrors the app's design system (globals.css):
 * warm neutrals, indigo for links and accents, coral for every CTA.
 */

import type { BaseTemplateParams } from '@/types';

// Re-export for consumers that import from here
export type { BaseTemplateParams };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://careerotter.io';

/**
 * Email-safe hex equivalents of the app's CSS variables. Email clients can't
 * read CSS custom properties, so the palette lives here — change it in one
 * place and every template follows.
 */
export const EMAIL_THEME = {
  pageBg: '#f8f7f5', // --background: warm off-white
  cardBg: '#ffffff',
  panelBg: '#faf9f7', // --muted: warm panel fill
  border: '#e9e6e1', // warm hairline
  borderLight: '#f0eeea', // row separators
  heading: '#241e19', // --foreground: warm near-black
  body: '#4a443f', // body copy
  muted: '#706a64', // --muted-foreground: secondary text
  primary: '#4338ca', // --primary: indigo — links and accents
  primaryTint: '#eef2ff', // indigo-50 panel (AI Coach blocks)
  primaryDark: '#3730a3', // indigo-800 text on the tint
  cta: '#f97316', // --accent: coral — ALL CTAs per the design system
  ctaForeground: '#ffffff',
} as const;

/**
 * Escape HTML entities so user-provided values (names, companies, roles) and
 * LLM output can be interpolated into email markup safely.
 */
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

export type WrapEmailParams = {
  /** Marketing unsubscribe target. Optional when `footerHtml` is supplied. */
  unsubscribeUrl?: string;
  /** Overrides the default "signed up for CareerOtter updates" footer line. */
  footerNote?: string;
  /**
   * Full custom footer markup, rendered in place of the default marketing
   * footer. Used by transactional/billing notices that must not carry a
   * marketing unsubscribe link (e.g. required pre-charge notices).
   */
  footerHtml?: string;
};

/**
 * Common email wrapper with branded header (logo + wordmark), content area,
 * and footer. The logo has an empty alt so clients that block images render
 * just the wordmark.
 */
export function wrapEmail(content: string, params: WrapEmailParams): string {
  const footerNote =
    params.footerNote ?? "You're receiving this because you signed up for CareerOtter updates.";

  const footer =
    params.footerHtml ??
    `
              <p style="margin: 0 0 8px; font-size: 12px; color: ${EMAIL_THEME.muted}; text-align: center;">
                ${footerNote}
              </p>
              <p style="margin: 0; font-size: 12px; color: ${EMAIL_THEME.muted}; text-align: center;">
                <a href="${escapeHtml(safeUrl(params.unsubscribeUrl ?? '#'))}" style="color: ${EMAIL_THEME.muted};">Unsubscribe</a>
              </p>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CareerOtter</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_THEME.pageBg};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_THEME.pageBg}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${EMAIL_THEME.cardBg}; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${EMAIL_THEME.heading};"><img src="${APP_URL}/logo_square.png" alt="" width="28" height="28" style="border: 0; border-radius: 6px; vertical-align: -5px; margin-right: 10px;">CareerOtter</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: ${EMAIL_THEME.panelBg}; border-top: 1px solid ${EMAIL_THEME.border};">${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * CTA button component — coral, matching the app's accent-on-every-CTA rule.
 */
export function ctaButton(text: string, url: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${escapeHtml(safeUrl(url))}" style="display: inline-block; padding: 12px 32px; background-color: ${EMAIL_THEME.cta}; color: ${EMAIL_THEME.ctaForeground}; text-decoration: none; font-weight: 600; border-radius: 6px;">${escapeHtml(text)}</a>
    </td>
  </tr>
</table>`;
}

export { APP_URL };
