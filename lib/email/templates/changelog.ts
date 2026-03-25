/**
 * Changelog Email Template
 *
 * Renders a weekly changelog email with segment-specific CTAs.
 */

import { wrapEmail, ctaButton, APP_URL } from './shared';
import type { BaseTemplateParams } from './shared';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ChangelogCategory = {
  title: string;
  items: string[];
};

export type ChangelogData = {
  weekOf: string; // e.g. "March 17, 2026"
  categories: ChangelogCategory[];
};

export type ChangelogTemplateParams = BaseTemplateParams & {
  changelog: ChangelogData;
  ctaText: string;
  ctaUrl: string;
};

function renderCategory(category: ChangelogCategory): string {
  const items = category.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #3f3f46; border-bottom: 1px solid #f4f4f5;">
          ${escapeHtml(item)}
        </td>
      </tr>`
    )
    .join('');

  return `
    <div style="margin: 0 0 24px;">
      <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #18181b;">${escapeHtml(category.title)}</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${items}
      </table>
    </div>`;
}

export function getChangelogHtml(params: ChangelogTemplateParams): string {
  const { changelog, ctaText, ctaUrl } = params;
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : 'Hi there,';

  const categoriesHtml = changelog.categories.map(renderCategory).join('');

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
      ${greeting}
    </p>
    <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46;">
      Here's what's new in AppTrack this week.
    </p>
    ${categoriesHtml}
    ${ctaButton(ctaText, ctaUrl)}
    <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; text-align: center;">
      Reply to this email if you have any questions. We read every reply.
    </p>`;

  return wrapEmail(content, params);
}

/**
 * Get CTA config based on audience segment
 */
export function getCtaForAudience(audience: 'free-users' | 'trial-users' | 'paid-users'): {
  ctaText: string;
  ctaUrl: string;
} {
  switch (audience) {
    case 'paid-users':
      return { ctaText: 'Go to Dashboard', ctaUrl: `${APP_URL}/dashboard` };
    case 'free-users':
    case 'trial-users':
    default:
      return { ctaText: 'Upgrade to Pro', ctaUrl: `${APP_URL}/dashboard/upgrade` };
  }
}
