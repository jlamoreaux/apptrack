/**
 * AppTrack -> CareerOtter rename announcement email.
 *
 * Sent once, owner-triggered, via POST /api/admin/rebrand-email. Copy comes from
 * the shared `REBRAND_COPY` constant so it can't drift from the in-app banner.
 *
 * Sender: the WARMED apptrack.ing domain, NOT the fresh careerotter.io —
 * announcing a domain change from a cold sending domain wrecks deliverability.
 */

import { REBRAND_COPY } from '@/lib/constants/rebrand';
import { escapeHtml, EMAIL_THEME, wrapEmail } from './shared';

export const REBRAND_ANNOUNCEMENT_SUBJECT = REBRAND_COPY.headline;

export const DEFAULT_REBRAND_FROM = 'Jordan at AppTrack <jordan@apptrack.ing>';
export const DEFAULT_REBRAND_REPLY_TO = 'jordan@apptrack.ing';

export type RebrandAnnouncementParams = {
  firstName?: string;
  unsubscribeUrl: string;
  /** CAN-SPAM: a valid physical postal address, rendered in the footer. */
  postalAddress: string;
};

export function getRebrandAnnouncementHtml(params: RebrandAnnouncementParams): string {
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : 'Hi there,';

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">
      ${greeting}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      Quick heads-up: <strong>${escapeHtml(REBRAND_COPY.headline)}</strong>
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      ${escapeHtml(REBRAND_COPY.subhead)} Your account, your data, and how you log in all
      stay exactly the same — you don't need to do anything.
    </p>
    <p style="margin: 0 0 8px; font-size: 16px; color: ${EMAIL_THEME.body};">
      One thing to note: our emails will start arriving from a careerotter.io address, so
      if you filter or star messages from us, you may want to update that.
    </p>
    <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_THEME.muted};">
      Questions? Just reply — I read every one.
    </p>`;

  // footerNote carries the CAN-SPAM postal address alongside wrapEmail's
  // unsubscribe link (kept because this is a commercial broadcast).
  return wrapEmail(content, {
    unsubscribeUrl: params.unsubscribeUrl,
    footerNote: `You're receiving this because you have a CareerOtter (formerly AppTrack) account. ${escapeHtml(
      params.postalAddress
    )}`,
  });
}
