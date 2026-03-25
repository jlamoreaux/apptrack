/**
 * Tests for Password Reset API endpoints
 * Tests POST /api/auth/forgot-password
 * Tests GET /api/auth/verify-reset
 * Tests POST /api/auth/reset-password
 */

const mockGenerateLink = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSendEmail = jest.fn();

jest.mock('@/lib/supabase/admin-client', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  }),
}));

jest.mock('@/lib/supabase/server-client', () => ({
  createCallbackClient: () => ({
    supabase: {
      auth: {
        verifyOtp: mockVerifyOtp,
      },
    },
    cookiesToSet: [
      { name: 'sb-session', value: 'test-session', options: {} },
    ],
  }),
  createClient: jest.fn().mockResolvedValue({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

jest.mock('@/lib/email/client', () => ({
  sendEmail: mockSendEmail.mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/email/drip-scheduler', () => ({
  getUnsubscribeUrl: (email: string) => `https://www.apptrack.ing/unsubscribe?email=${email}`,
}));

jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { NextRequest, NextResponse } from 'next/server';

// NextResponse.redirect isn't fully implemented in Jest's environment.
// Provide a minimal mock that returns a redirect-like object.
const originalRedirect = NextResponse.redirect;
beforeAll(() => {
  (NextResponse as any).redirect = (url: URL | string) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    return {
      status: 307,
      headers: new Headers({ location: urlStr }),
      cookies: { set: jest.fn() },
    };
  };
});
afterAll(() => {
  (NextResponse as any).redirect = originalRedirect;
});

function createRequest(body: Record<string, unknown>, method = 'POST') {
  return new NextRequest('http://localhost:3000/api/auth/forgot-password', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/auth/forgot-password', () => {
  let handler: typeof import('@/app/api/auth/forgot-password/route').POST;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    const mod = await import('@/app/api/auth/forgot-password/route');
    handler = mod.POST;
  });

  it('returns 400 if email is missing', async () => {
    const res = await handler(createRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Email is required');
  });

  it('generates link and sends branded email on success', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'test-token-hash' } },
      error: null,
    });

    const res = await handler(createRequest({ email: 'test@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'test@example.com',
    });

    // Should send email via Resend with verify-reset URL
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Reset your AppTrack password',
      })
    );

    const sentHtml = mockSendEmail.mock.calls[0][0].html;
    expect(sentHtml).toContain('verify-reset?token=test-token-hash');
    expect(sentHtml).toContain('Reset Password');
  });

  it('returns success even when generateLink fails (prevents email enumeration)', async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    });

    const res = await handler(createRequest({ email: 'nonexistent@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/verify-reset', () => {
  let handler: typeof import('@/app/api/auth/verify-reset/route').GET;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    const mod = await import('@/app/api/auth/verify-reset/route');
    handler = mod.GET;
  });

  it('redirects to error page if token is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/verify-reset');
    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('auth/error');
  });

  it('verifies token and redirects to /reset-password with cookies', async () => {
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null });

    const req = new NextRequest('http://localhost:3000/api/auth/verify-reset?token=valid-token');
    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/reset-password');

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: 'valid-token',
      type: 'recovery',
    });
  });

  it('redirects to error page on invalid token', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: 'Token expired' },
    });

    const req = new NextRequest('http://localhost:3000/api/auth/verify-reset?token=expired-token');
    const res = await handler(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('auth/error');
  });
});

describe('POST /api/auth/reset-password', () => {
  let handler: typeof import('@/app/api/auth/reset-password/route').POST;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('@/app/api/auth/reset-password/route');
    handler = mod.POST;
  });

  it('returns 400 if password is too short', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: 'short' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('updates password successfully', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPassword123!' });
  });

  it('returns error from Supabase', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: 'Password too weak' },
    });

    const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: 'WeakPass1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Password too weak');
  });
});
