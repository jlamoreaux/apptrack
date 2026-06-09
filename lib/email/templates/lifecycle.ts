/**
 * Lifecycle Email Templates (retention Phase 2b/2c)
 *
 * Recurring, user-state-driven emails — distinct from the one-shot drip
 * sequence in `drip.ts`. These are sent directly by their cron jobs rather
 * than scheduled through the drip engine (which dedups one template per email).
 */

import { wrapEmail, ctaButton, APP_URL } from './shared';
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
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  const rows = jobs
    .map(
      (job) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f1f1;">
          <p style="margin: 0; font-size: 15px; color: #18181b; font-weight: 600;">${job.role}</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #71717a;">${job.company} · no update in ${job.daysSinceUpdate} days</p>
          <p style="margin: 8px 0 0;">
            <a href="${applicationUrl(job.applicationId)}" style="font-size: 13px; color: #2563eb; text-decoration: none;">Update status &rarr;</a>
          </p>
        </td>
      </tr>`
    )
    .join('');

  const lead =
    jobs.length === 1
      ? `Still waiting to hear back on <strong>${jobs[0].role}</strong> at <strong>${jobs[0].company}</strong>?`
      : `You have ${jobs.length} applications that haven't been updated in a while.`;

  return wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">${greeting}</p>
    <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">${lead} A quick status update keeps your pipeline accurate — or mark it as no response.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px; border: 1px solid #f1f1f1; border-radius: 6px;">
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
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  const stat = (value: number, label: string) => `
    <td align="center" style="padding: 16px 8px;">
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #18181b;">${value}</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #71717a;">${label}</p>
    </td>`;

  const insightBlock = insight
    ? `<div style="margin: 16px 0; padding: 16px; background-color: #f5f8ff; border-radius: 6px;">
         <p style="margin: 0; font-size: 14px; color: #1e3a8a;"><strong>AI Coach:</strong> ${insight}</p>
       </div>`
    : '';

  return wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">${greeting}</p>
    <p style="margin: 0 0 8px; font-size: 16px; color: #3f3f46;">Here's your pipeline this week:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px; background-color: #fafafa; border-radius: 6px;">
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
