/**
 * Tests for Token Validation API endpoint
 * Tests GET /api/auth/validate
 */

// Mock jose before any imports
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setSubject: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock.jwt.token'),
  })),
  jwtVerify: jest.fn(),
}));

// Mock all supabase modules before importing
jest.mock('@/lib/supabase/server', () => ({
  getUser: jest.fn(),
  createClient: jest.fn(),
  createMiddlewareClient: jest.fn(),
}));
jest.mock('@/lib/supabase/server-client', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { extension_token_version: 1 }, error: null }),
        }),
      }),
    }),
  }),
}));
jest.mock('@/lib/supabase/browser-client', () => ({
  supabase: {},
}));
jest.mock('@/lib/supabase/queries', () => ({
  getUser: jest.fn(),
}));
jest.mock('@/lib/auth/extension-auth');
jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { GET } from '@/app/api/auth/validate/route';
import * as extensionAuth from '@/lib/auth/extension-auth';

const mockVerifyExtensionToken = extensionAuth.verifyExtensionToken as jest.MockedFunction<
  typeof extensionAuth.verifyExtensionToken
>;

describe('GET /api/auth/validate', () => {
  const mockVerifiedToken = {
    userId: 'user-123',
    email: 'test@example.com',
    tokenVersion: 1,
    expiresAt: new Date('2024-02-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user info for valid Bearer token', async () => {
    mockVerifyExtensionToken.mockResolvedValue(mockVerifiedToken);

    const request = new Request('http://localhost/api/auth/validate', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe('user-123');
    expect(data.email).toBe('test@example.com');
    expect(mockVerifyExtensionToken).toHaveBeenCalledWith('valid-token');
  });

  it('should return 401 for missing Authorization header', async () => {
    const request = new Request('http://localhost/api/auth/validate');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Missing or invalid Authorization header');
    expect(mockVerifyExtensionToken).not.toHaveBeenCalled();
  });

  it('should return 401 for malformed Authorization header (missing Bearer prefix)', async () => {
    const request = new Request('http://localhost/api/auth/validate', {
      headers: {
        Authorization: 'token-without-bearer-prefix',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Missing or invalid Authorization header');
    expect(mockVerifyExtensionToken).not.toHaveBeenCalled();
  });

  it('should return 401 for empty token after Bearer prefix', async () => {
    const request = new Request('http://localhost/api/auth/validate', {
      headers: {
        Authorization: 'Bearer ',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Missing token');
    expect(mockVerifyExtensionToken).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid or expired token', async () => {
    mockVerifyExtensionToken.mockResolvedValue(null);

    const request = new Request('http://localhost/api/auth/validate', {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid or expired token');
    expect(mockVerifyExtensionToken).toHaveBeenCalledWith('invalid-token');
  });

  it('should return 500 on token verification error', async () => {
    mockVerifyExtensionToken.mockRejectedValue(new Error('Verification failed'));

    const request = new Request('http://localhost/api/auth/validate', {
      headers: {
        Authorization: 'Bearer error-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Token validation failed');
  });
});
