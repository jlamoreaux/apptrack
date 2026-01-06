/**
 * Tests for Extension Authentication
 * Tests the isInRefreshWindow utility and integration behavior
 *
 * Note: JWT signing/verification is tested indirectly through API endpoint tests
 * since jose requires Node/browser crypto APIs not available in jsdom
 */

// Mock jose before any imports to prevent ESM issues
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

// Mock supabase modules
jest.mock('@/lib/supabase/server-client', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));
jest.mock('@/lib/supabase/queries', () => ({
  getUser: jest.fn(),
}));
jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { isInRefreshWindow } from '@/lib/auth/extension-auth';

describe('Extension Auth', () => {
  describe('isInRefreshWindow', () => {
    it('should return true when token expires within 3 days', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // 2 days from now

      expect(isInRefreshWindow(expiresAt)).toBe(true);
    });

    it('should return false when token expires after 3 days', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5); // 5 days from now

      expect(isInRefreshWindow(expiresAt)).toBe(false);
    });

    it('should return false when token is already expired', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // 1 day ago

      expect(isInRefreshWindow(expiresAt)).toBe(false);
    });

    it('should return true at the boundary (exactly 3 days)', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      expect(isInRefreshWindow(expiresAt)).toBe(true);
    });

    it('should return true for expiry in hours (less than 1 day)', () => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12); // 12 hours from now

      expect(isInRefreshWindow(expiresAt)).toBe(true);
    });

    it('should return false when expiry is past the 3-day refresh window', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 4); // 4 days from now, past the 3-day window

      expect(isInRefreshWindow(expiresAt)).toBe(false);
    });
  });

  describe('module exports', () => {
    it('should export all required functions', async () => {
      const extensionAuth = await import('@/lib/auth/extension-auth');

      expect(typeof extensionAuth.signExtensionToken).toBe('function');
      expect(typeof extensionAuth.verifyExtensionToken).toBe('function');
      expect(typeof extensionAuth.isInRefreshWindow).toBe('function');
      expect(typeof extensionAuth.getAuthenticatedUser).toBe('function');
      expect(typeof extensionAuth.revokeExtensionTokens).toBe('function');
    });
  });
});
