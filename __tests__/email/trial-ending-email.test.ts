/**
 * Tests for the pre-charge trial-ending email (sendTrialEndingEmail) and the
 * parameterized wrapEmail footer.
 *
 * The Resend client is replaced by mocking `@/lib/email/client`'s `sendEmail`,
 * so we inspect the exact payload the sender builds.
 */

// @jest-environment node

const mockSendEmail = jest.fn();

jest.mock('@/lib/email/client', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import {
  sendTrialEndingEmail,
  sendRoastReadyEmail,
} from '@/lib/email/transactional';

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

/** Read the single argument passed to the mocked sendEmail. */
function lastSendEmailCall(): SendEmailArgs {
  return mockSendEmail.mock.calls.at(-1)![0] as SendEmailArgs;
}

const BASE_OPTIONS = {
  email: 'user@example.com',
  firstName: 'Jordan',
  planName: 'AppTrack Pro',
  amountFormatted: '$9.00',
  cadence: 'month',
  trialEndDate: 'June 5, 2026',
  manageUrl: 'https://www.apptrack.ing/dashboard/settings',
};

// Matches the emoji ranges that would appear in marketing-style copy.
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe('sendTrialEndingEmail', () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('sends to the user with replyTo support@apptrack.ing', async () => {
    await sendTrialEndingEmail(BASE_OPTIONS);

    const call = lastSendEmailCall();
    expect(call.to).toBe('user@example.com');
    expect(call.replyTo).toBe('support@apptrack.ing');
  });

  it('includes the trial end date, amount, cadence, plan name, and manage URL in the html', async () => {
    await sendTrialEndingEmail(BASE_OPTIONS);

    const { html } = lastSendEmailCall();
    expect(html).toContain('June 5, 2026');
    expect(html).toContain('$9.00');
    expect(html).toContain('month');
    expect(html).toContain('AppTrack Pro');
    expect(html).toContain('https://www.apptrack.ing/dashboard/settings');
    // States the cancellation mechanism, not just a link.
    expect(html).toContain('cancel before');
  });

  it('uses the transactional footer, not the Resume Roast marketing footer', async () => {
    await sendTrialEndingEmail(BASE_OPTIONS);

    const { html } = lastSendEmailCall();
    expect(html).toContain('you have an active trial on AppTrack');
    expect(html).toContain('Manage subscription');
    expect(html).not.toContain('Resume Roast');
    expect(html).not.toContain('Unsubscribe');
  });

  it('uses the amount-known subject with an em dash', async () => {
    await sendTrialEndingEmail(BASE_OPTIONS);

    const { subject } = lastSendEmailCall();
    expect(subject).toBe(
      "Your AppTrack trial ends June 5, 2026 — you'll be charged $9.00"
    );
    expect(subject).toContain('—');
  });

  it('uses the generic subject and renewal copy when amount is unknown', async () => {
    await sendTrialEndingEmail({
      ...BASE_OPTIONS,
      amountFormatted: undefined,
    });

    const call = lastSendEmailCall();
    expect(call.subject).toBe('Your AppTrack trial ends June 5, 2026');
    expect(call.subject).not.toContain("you'll be charged");
    expect(call.html).toContain('will renew');
    expect(call.html).not.toContain("you'll be charged");
  });

  it('escapes interpolated values containing HTML', async () => {
    await sendTrialEndingEmail({
      ...BASE_OPTIONS,
      planName: '<script>alert(1)</script>',
    });

    const { html } = lastSendEmailCall();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('contains no emoji in the subject or body', async () => {
    await sendTrialEndingEmail(BASE_OPTIONS);

    const { subject, html } = lastSendEmailCall();
    expect(EMOJI_REGEX.test(subject)).toBe(false);
    expect(EMOJI_REGEX.test(html)).toBe(false);
  });

  it('returns success:false when the send fails', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('resend down'));

    const result = await sendTrialEndingEmail(BASE_OPTIONS);
    expect(result.success).toBe(false);
  });
});

describe('wrapEmail footer regression', () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('sendRoastReadyEmail still renders the original Resume Roast marketing footer', async () => {
    await sendRoastReadyEmail({
      email: 'user@example.com',
      firstName: 'Jordan',
      roastId: 'roast-123',
    });

    const { html } = lastSendEmailCall();
    expect(html).toContain(
      "You're receiving this because you used Resume Roast on AppTrack."
    );
    expect(html).toContain('Unsubscribe');
    expect(html).not.toContain('you have an active trial on AppTrack');
  });
});
