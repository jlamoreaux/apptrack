/**
 * Tests for the in-app support email foundation:
 * - escapeHtml / safeUrl helpers exported from lib/email/transactional
 * - sendEmail's replyTo forwarding in lib/email/client
 */

// @jest-environment node

import { escapeHtml, safeUrl } from '@/lib/email/transactional';

describe('escapeHtml', () => {
  it('escapes all five special HTML characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('escapes a mixed string in a single pass', () => {
    expect(escapeHtml('<a href="x">Tom & Jerry\'s</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('safeUrl', () => {
  it('returns the URL unchanged for https', () => {
    expect(safeUrl('https://www.apptrack.ing/support')).toBe(
      'https://www.apptrack.ing/support'
    );
  });

  it('returns the URL unchanged for http', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('returns "#" for the javascript: scheme', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
  });

  it('returns "#" for an invalid URL', () => {
    expect(safeUrl('not a url')).toBe('#');
  });
});

describe('sendEmail replyTo forwarding', () => {
  const mockSend = jest.fn();

  // Mock the Resend constructor so client.ts builds a non-null `resend` client.
  jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  }));

  const ORIGINAL_API_KEY = process.env.RESEND_API_KEY;

  beforeAll(() => {
    process.env.RESEND_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = ORIGINAL_API_KEY;
    }
  });

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
  });

  /** Re-import sendEmail in isolation so the mocked Resend is applied at module load. */
  function loadSendEmail() {
    let send: typeof import('@/lib/email/client').sendEmail;
    jest.isolateModules(() => {
      send = require('@/lib/email/client').sendEmail;
    });
    return send!;
  }

  it('forwards replyTo to the Resend client when provided', async () => {
    const sendEmail = loadSendEmail();

    await sendEmail({
      to: 'user@example.com',
      subject: 'Support reply',
      html: '<p>Hi</p>',
      replyTo: 'support@apptrack.ing',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      replyTo: 'support@apptrack.ing',
    });
  });

  it('omits replyTo from the payload when not provided', async () => {
    const sendEmail = loadSendEmail();

    await sendEmail({
      to: 'user@example.com',
      subject: 'No reply-to',
      html: '<p>Hi</p>',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).not.toHaveProperty('replyTo');
  });
});
