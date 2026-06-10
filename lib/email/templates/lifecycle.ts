/**
 * Lifecycle Email Templates (retention Phase 2b/2c)
 *
 * Recurring, user-state-driven emails — distinct from the one-shot drip
 * sequence in `drip.ts`. These are sent directly by their cron jobs rather
 * than scheduled through the drip engine (which dedups one template per email).
 */

import { wrapEmail, ctaButton, escapeHtml, APP_URL, EMAIL_THEME } from './shared';
import type { BaseTemplateParams } from './shared';

export type StaleJob = {
  applicationId: string;
  company: string;
  role: string;
  status: string;
  daysSinceUpdate: number;
};

export type StaleReminderParams = BaseTemplateParams & {
  jobs: StaleJob[];
};

function applicationUrl(applicationId: string): string {
  // Deep-link to the specific application; `focus=status` lets the detail page
  // open the status picker (UI hook).
  return `${APP_URL}/dashboard/application/${applicationId}?focus=status`;
}

export function staleReminderTemplate(params: StaleReminderParams): string {
  const { firstName, jobs } = params;
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';

  const rows = jobs
    .map(
      (job) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid ${EMAIL_THEME.borderLight};">
          <p style="margin: 0; font-size: 15px; color: ${EMAIL_THEME.heading}; font-weight: 600;">${escapeHtml(job.role)}</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: ${EMAIL_THEME.muted};">${escapeHtml(job.company)} · no update in ${job.daysSinceUpdate} days</p>
          <p style="margin: 8px 0 0;">
            <a href="${applicationUrl(job.applicationId)}" style="font-size: 13px; color: ${EMAIL_THEME.primary}; text-decoration: none;">Update status &rarr;</a>
          </p>
        </td>
      </tr>`
    )
    .join('');

  const lead =
    jobs.length === 1
      ? `Still waiting to hear back on <strong>${escapeHtml(jobs[0].role)}</strong> at <strong>${escapeHtml(jobs[0].company)}</strong>?`
      : `You have ${jobs.length} applications that haven't been updated in a while.`;

  return wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">${greeting}</p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">${lead} A quick status update keeps your pipeline accurate — or mark it as no response.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px; border: 1px solid ${EMAIL_THEME.borderLight}; border-radius: 6px;">
      ${rows}
    </table>
    ${ctaButton('Review your pipeline', `${APP_URL}/dashboard`)}
  `,
    params
  );
}

export type WeeklyDigestParams = BaseTemplateParams & {
  activeCount: number;
  needsFollowUp: number;
  newThisWeek: number;
  insight?: string;
};

export function weeklyDigestTemplate(params: WeeklyDigestParams): string {
  const { firstName, activeCount, needsFollowUp, newThisWeek, insight } = params;
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';

  const stat = (value: number, label: string) => `
    <td align="center" style="padding: 16px 8px;">
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_THEME.heading};">${value}</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: ${EMAIL_THEME.muted};">${label}</p>
    </td>`;

  const insightBlock = insight
    ? `<div style="margin: 16px 0; padding: 16px; background-color: ${EMAIL_THEME.primaryTint}; border-radius: 6px;">
         <p style="margin: 0; font-size: 14px; color: ${EMAIL_THEME.primaryDark};"><strong>AI Coach:</strong> ${escapeHtml(insight)}</p>
       </div>`
    : '';

  return wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">${greeting}</p>
    <p style="margin: 0 0 8px; font-size: 16px; color: ${EMAIL_THEME.body};">Here's your pipeline this week:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px; background-color: ${EMAIL_THEME.panelBg}; border-radius: 6px;">
      <tr>
        ${stat(activeCount, 'active')}
        ${stat(needsFollowUp, 'need follow-up')}
        ${stat(newThisWeek, 'new this week')}
      </tr>
    </table>
    ${insightBlock}
    ${ctaButton('Open AppTrack', `${APP_URL}/dashboard`)}
  `,
    params
  );
}
