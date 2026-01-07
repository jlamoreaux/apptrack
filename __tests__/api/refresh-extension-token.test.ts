/**
 * Tests for Refresh Extension Token API endpoint
 * Tests POST /api/auth/refresh-extension-token
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

// Mock dependencies before importing route
jest.mock('@/lib/auth/extension-auth');
jest.mock('@/lib/redis/client', () => ({
  createRateLimiter: jest.fn().mockReturnValue({
    limit: jest.fn().mockResolvedValue({ success: true }),
  }),
}));
jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { POST } from '@/app/api/auth/refresh-extension-token/route';
import * as extensionAuth from '@/lib/auth/extension-auth';

// Helper to create mock NextRequest
function createMockRequest(options: {
  authHeader?: string;
  body?: any;
} = {}) {
  const headers = new Map<string, string>();
  if (options.authHeader) {
    headers.set('authorization', options.authHeader);
  }

  return {
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
    json: jest.fn().mockResolvedValue(options.body || {}),
  } as any;
}

const mockVerifyExtensionToken = extensionAuth.verifyExtensionToken as jest.MockedFunction<
  typeof extensionAuth.verifyExtensionToken
>;
const mockSignExtensionToken = extensionAuth.signExtensionToken as jest.MockedFunction<
  typeof extensionAuth.signExtensionToken
>;
const mockIsInRefreshWindow = extensionAuth.isInRefreshWindow as jest.MockedFunction<
  typeof extensionAuth.isInRefreshWindow
>;

describe('POST /api/auth/refresh-extension-token', () => {
  const mockVerifiedToken = {
    userId: 'user-123',
    email: 'test@example.com',
    tokenVersion: 1,
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  };

  const mockNewToken = {
    token: 'new-jwt-token',
    expiresAt: '2024-02-08T00:00:00Z',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyExtensionToken.mockResolvedValue(mockVerifiedToken);
    mockSignExtensionToken.mockResolvedValue(mockNewToken);
    mockIsInRefreshWindow.mockReturnValue(true);
  });

  describe('token extraction', () => {
    it('should accept token from Authorization header', async () => {
      const request = createMockRequest({
        authHeader: 'Bearer valid-token',
      });

      await POST(request);

      expect(mockVerifyExtensionToken).toHaveBeenCalledWith('valid-token');
    });

    it('should accept token from request body', async () => {
      const request = createMockRequest({
        body: { token: 'body-token' },
      });

      await POST(request);

      expect(mockVerifyExtensionToken).toHaveBeenCalledWith('body-token');
    });

    it('should prefer Authorization header over body', async () => {
      const request = createMockRequest({
        authHeader: 'Bearer header-token',
        body: { token: 'body-token' },
      });

      await POST(request);

      expect(mockVerifyExtensionToken).toHaveBeenCalledWith('header-token');
    });

    it('should return 401 when no token provided', async () => {
      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Token is required');
    });
  });

  describe('token validation', () => {
    it('should return 401 for invalid token', async () => {
      mockVerifyExtensionToken.mockResolvedValue(null);

      const request = createMockRequest({
        authHeader: 'Bearer invalid-token',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should return 401 for expired token', async () => {
      mockVerifyExtensionToken.mockResolvedValue(null);

      const request = createMockRequest({
        authHeader: 'Bearer expired-token',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired token');
    });
  });

  describe('refresh window logic', () => {
    it('should issue new token when in refresh window', async () => {
      mockIsInRefreshWindow.mockReturnValue(true);

      const request = createMockRequest({
        authHeader: 'Bearer valid-token',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('new-jwt-token');
      expect(data.expiresAt).toBe('2024-02-08T00:00:00Z');
      expect(mockSignExtensionToken).toHaveBeenCalledWith('user-123', 'test@example.com');
    });

    it('should return current token info when not in refresh window', async () => {
      mockIsInRefreshWindow.mockReturnValue(false);

      const request = createMockRequest({
        authHeader: 'Bearer valid-token',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('valid-token');
      expect(data.message).toBe('Token not yet eligible for refresh');
      expect(mockSignExtensionToken).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 500 on token generation error', async () => {
      mockIsInRefreshWindow.mockReturnValue(true);
      mockSignExtensionToken.mockRejectedValue(new Error('Token generation failed'));

      const request = createMockRequest({
        authHeader: 'Bearer valid-token',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to refresh token');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const request = {
        headers: {
          get: () => null,
        },
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Token is required');
    });
  });
});
