/**
 * Tests for Extension Token API endpoint
 * Tests POST /api/auth/extension-token
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
jest.mock('@/lib/supabase/browser-client', () => ({
  supabase: {},
}));
jest.mock('@/lib/auth/extension-auth');
jest.mock('@/lib/auth/auth-rate-limit', () => ({
  checkAuthRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { POST } from '@/app/api/auth/extension-token/route';
import { getUser } from '@/lib/supabase/server';
import * as extensionAuth from '@/lib/auth/extension-auth';

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockSignExtensionToken = extensionAuth.signExtensionToken as jest.MockedFunction<
  typeof extensionAuth.signExtensionToken
>;

describe('POST /api/auth/extension-token', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockTokenResult = {
    token: 'mock-jwt-token',
    expiresAt: '2024-02-01T00:00:00Z',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser as any);
    mockSignExtensionToken.mockResolvedValue(mockTokenResult);
  });

  it('should generate token for authenticated user', async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe('mock-jwt-token');
    expect(data.expiresAt).toBe('2024-02-01T00:00:00Z');
    expect(data.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(mockSignExtensionToken).toHaveBeenCalledWith('user-123', 'test@example.com');
  });

  it('should return 401 for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockSignExtensionToken).not.toHaveBeenCalled();
  });

  it('should return 400 for user without email', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      email: null,
    } as any);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User email is required');
    expect(mockSignExtensionToken).not.toHaveBeenCalled();
  });

  it('should return 500 on token generation error', async () => {
    mockSignExtensionToken.mockRejectedValue(new Error('Token generation failed'));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate extension token');
  });

  it('should handle user with undefined email', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      email: undefined,
    } as any);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User email is required');
  });
});
