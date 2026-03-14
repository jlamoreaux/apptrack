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

function wrapEmail(content: string, unsubscribeUrl: string): string {
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
                <a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
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
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${url}" style="display: inline-block; padding: 12px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 500; border-radius: 6px;">${text}</a>
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

  const html = wrapEmail(
    `
    <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
      ${firstName ? `Hi ${firstName},` : 'Hi there,'}
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
