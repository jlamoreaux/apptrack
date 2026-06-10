/**
 * Shared Email Template Components
 *
 * Reusable HTML builders for all email templates (drip, changelog, etc.)
 */

import type { BaseTemplateParams } from '@/types';

// Re-export for consumers that import from here
export type { BaseTemplateParams };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.apptrack.ing';

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

/**
 * Common email wrapper with header, content area, and footer
 */
export function wrapEmail(content: string, params: BaseTemplateParams): string {
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
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">AppTrack</h1>
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
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #71717a; text-align: center;">
                You're receiving this because you signed up for AppTrack updates.
              </p>
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                <a href="${escapeHtml(params.unsubscribeUrl)}" style="color: #71717a;">Unsubscribe</a>
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

/**
 * CTA button component
 */
export function ctaButton(text: string, url: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${escapeHtml(safeUrl(url))}" style="display: inline-block; padding: 12px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 500; border-radius: 6px;">${escapeHtml(text)}</a>
    </td>
  </tr>
</table>`;
}

export { APP_URL };
