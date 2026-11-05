/**
 * Year in review announcement email.
 *
 * The recap's reveal is the label (the otter), so the email withholds it: users
 * with a label see all seven otters and are asked which one is theirs. Users
 * below the label threshold get a plainer invitation with the walking otter.
 * No stats beyond the application count, which the user already knows.
 */

import type { RecapAudience } from '@/lib/year-in-review/email-recipients';
import { APP_URL, EMAIL_THEME, ctaButton, escapeHtml, wrapEmail } from './shared';

export const YEAR_IN_REVIEW_WAVES = ['launch', 'last-call'] as const;
export type YearInReviewWave = (typeof YEAR_IN_REVIEW_WAVES)[number];

export function isYearInReviewWave(value: unknown): value is YearInReviewWave {
  return typeof value === 'string' && (YEAR_IN_REVIEW_WAVES as readonly string[]).includes(value);
}

/** `campaign_sends.campaign` id, one per wave per year. */
export function yearInReviewCampaignId(year: number, wave: YearInReviewWave): string {
  return `year_in_review_${year}_${wave.replace('-', '_')}`;
}

export type YearInReviewEmailParams = {
  year: number;
  wave: YearInReviewWave;
  audience: RecapAudience;
  applications: number;
  hired: boolean;
  firstName?: string;
  unsubscribeUrl: string;
  /** CAN-SPAM: a valid physical postal address, rendered in the footer. */
  postalAddress: string;
};

type Copy = { subject: string; preheader: string; lead: string; imageCaption?: string; cta: string };

function applicationsPhrase(n: number): string {
  return n === 1 ? '1 application' : `${n.toLocaleString('en-US')} applications`;
}

function copyFor(params: YearInReviewEmailParams): Copy {
  const { year, wave, audience, applications } = params;
  const logged = `You logged ${applicationsPhrase(applications)} in ${year}.`;

  if (audience === 'labeled') {
    return wave === 'launch'
      ? {
          subject: `Which otter were you in ${year}?`,
          preheader: `Your ${year} job search recap is ready, and one of these otters is you.`,
          lead: `${logged} We added them up: your busiest stretch, where things moved, the work behind it, and the search style that fits how you went about it.`,
          imageCaption: 'Seven search styles. One of them is yours.',
          cta: 'See which one',
        }
      : {
          subject: `Still wondering which otter you were in ${year}?`,
          preheader: `Your ${year} recap is waiting, and so is your search style.`,
          lead: `${logged} Your recap has them added up, and one of these seven otters is waiting for you at the end of it.`,
          imageCaption: 'Seven search styles. One of them is yours.',
          cta: 'Find out',
        };
  }

  return wave === 'launch'
    ? {
        subject: `Your ${year} job search, in review`,
        preheader: 'Every application you logged, added up.',
        lead: `${logged} Your recap adds up where they went and the work behind them.`,
        cta: 'See your recap',
      }
    : {
        subject: `Your ${year} recap is still here`,
        preheader: 'A short look back at your job search this year.',
        lead: `${logged} Your recap is still waiting, and it takes about a minute.`,
        cta: 'See your recap',
      };
}

function recapUrl(params: YearInReviewEmailParams): string {
  const url = new URL('/dashboard/year-in-review', APP_URL);
  url.searchParams.set('year', String(params.year));
  url.searchParams.set('utm_source', 'email');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', yearInReviewCampaignId(params.year, params.wave));
  return url.toString();
}

function image(params: YearInReviewEmailParams): string {
  const labeled = params.audience === 'labeled';
  const src = `${APP_URL}/images/year-in-review/email/${labeled ? 'lineup.jpg' : 'still-in-it.jpg'}`;
  const alt = labeled
    ? 'Seven otters, each dressed as a different search style'
    : 'The otter walking forward with a bag over one shoulder';
  const width = labeled ? 536 : 240;
  return `
    <p style="margin: 24px 0 8px; text-align: center;">
      <img src="${src}" alt="${alt}" width="${width}" style="display: block; margin: 0 auto; width: 100%; max-width: ${width}px; height: auto; border: 0; border-radius: 8px;">
    </p>`;
}

export function getYearInReviewEmail(params: YearInReviewEmailParams): { subject: string; html: string } {
  const copy = copyFor(params);
  const greeting = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : 'Hi there,';

  const caption = copy.imageCaption
    ? `<p style="margin: 0; font-size: 16px; font-weight: 600; text-align: center; color: ${EMAIL_THEME.heading};">${escapeHtml(copy.imageCaption)}</p>`
    : '';

  // A hire is known to the user, so naming it spoils nothing; the recap still holds the details.
  const hired = params.hired
    ? `<p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">And it ends with the job you landed.</p>`
    : '';

  const content = `
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.heading};">
      ${greeting}
    </p>
    <p style="margin: 0 0 16px; font-size: 16px; color: ${EMAIL_THEME.body};">
      ${escapeHtml(copy.lead)}
    </p>
    ${hired}
    ${image(params)}
    ${caption}
    ${ctaButton(copy.cta, recapUrl(params))}
    <p style="margin: 0; font-size: 14px; color: ${EMAIL_THEME.muted};">
      Your recap is private. Nothing is shared unless you choose to share it.
    </p>`;

  return {
    subject: copy.subject,
    html: wrapEmail(content, {
      unsubscribeUrl: params.unsubscribeUrl,
      preheader: copy.preheader,
      footerNote: `You're receiving this because you tracked your job search with CareerOtter in ${params.year}. ${escapeHtml(
        params.postalAddress
      )}`,
    }),
  };
}
