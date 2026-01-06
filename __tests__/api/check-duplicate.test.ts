/**
 * Tests for Check Duplicate API endpoint
 * Tests GET /api/applications/check-duplicate
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

import { GET } from '@/app/api/applications/check-duplicate/route';
import * as extensionAuth from '@/lib/auth/extension-auth';
import { createClient } from '@/lib/supabase/server-client';

// Helper to create mock NextRequest with query params
function createMockRequest(queryParams: Record<string, string> = {}, authHeader?: string) {
  const url = new URL('http://localhost:3000/api/applications/check-duplicate');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers = new Map<string, string>();
  if (authHeader) {
    headers.set('authorization', authHeader);
  }

  return {
    url: url.toString(),
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
  } as any;
}

// Mock dependencies
jest.mock('@/lib/auth/extension-auth');
jest.mock('@/lib/supabase/server-client');
jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetAuthenticatedUser = extensionAuth.getAuthenticatedUser as jest.MockedFunction<
  typeof extensionAuth.getAuthenticatedUser
>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('GET /api/applications/check-duplicate', () => {
  let mockSupabaseClient: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    source: 'session' as const,
  };

  const mockApplication = {
    id: 'app-123',
    company: 'Tech Corp',
    role: 'Software Engineer',
    status: 'Applied',
    date_applied: '2024-01-15',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
  });

  describe('authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept session-based auth', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({
        id: 'session-user',
        email: 'session@example.com',
        source: 'session',
      });

      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept Bearer token auth', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({
        id: 'token-user',
        email: 'token@example.com',
        source: 'extension',
      });

      const request = createMockRequest(
        { company: 'Tech Corp', role: 'Engineer' },
        'Bearer valid-token'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('parameter validation', () => {
    it('should return 400 when company is missing', async () => {
      const request = createMockRequest({ role: 'Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('company and role query parameters are required');
    });

    it('should return 400 when role is missing', async () => {
      const request = createMockRequest({ company: 'Tech Corp' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('company and role query parameters are required');
    });

    it('should return 400 when both are missing', async () => {
      const request = createMockRequest({});
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('company and role query parameters are required');
    });
  });

  describe('duplicate detection', () => {
    it('should return exists: false when no duplicate found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({ data: null, error: null });

      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(false);
      expect(data.application).toBeUndefined();
    });

    it('should return exists: true with application data when duplicate found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: mockApplication,
        error: null,
      });

      const request = createMockRequest({ company: 'Tech Corp', role: 'Software Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.application).toEqual({
        id: 'app-123',
        company: 'Tech Corp',
        role: 'Software Engineer',
        status: 'Applied',
        date_applied: '2024-01-15',
      });
    });

    it('should use case-insensitive matching', async () => {
      const request = createMockRequest({ company: 'TECH CORP', role: 'software engineer' });
      await GET(request);

      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('company', 'TECH CORP');
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('role', 'software engineer');
    });

    it('should only check non-archived applications', async () => {
      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      await GET(request);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('archived', false);
    });

    it('should limit results to 1', async () => {
      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      await GET(request);

      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check for duplicates');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSupabaseClient.maybeSingle.mockRejectedValue(new Error('Unexpected error'));

      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check for duplicates');
    });
  });

  describe('query building', () => {
    it('should select only necessary fields', async () => {
      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      await GET(request);

      expect(mockSupabaseClient.select).toHaveBeenCalledWith('id, company, role, status, date_applied');
    });

    it('should query the applications table', async () => {
      const request = createMockRequest({ company: 'Tech Corp', role: 'Engineer' });
      await GET(request);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('applications');
    });
  });

  describe('input validation', () => {
    it('should return 400 when company exceeds max length', async () => {
      const longCompany = 'A'.repeat(201);
      const request = createMockRequest({ company: longCompany, role: 'Engineer' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('company and role must be less than 200 characters');
    });

    it('should return 400 when role exceeds max length', async () => {
      const longRole = 'B'.repeat(201);
      const request = createMockRequest({ company: 'Tech Corp', role: longRole });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('company and role must be less than 200 characters');
    });

    it('should accept inputs at exactly max length', async () => {
      const maxCompany = 'A'.repeat(200);
      const maxRole = 'B'.repeat(200);
      const request = createMockRequest({ company: maxCompany, role: maxRole });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should escape ILIKE special characters in company', async () => {
      const request = createMockRequest({ company: 'Tech%Corp', role: 'Engineer' });
      await GET(request);

      // % should be escaped as \%
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('company', 'Tech\\%Corp');
    });

    it('should escape ILIKE special characters in role', async () => {
      const request = createMockRequest({ company: 'Tech', role: 'Software_Engineer' });
      await GET(request);

      // _ should be escaped as \_
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('role', 'Software\\_Engineer');
    });

    it('should escape backslashes', async () => {
      const request = createMockRequest({ company: 'Tech\\Corp', role: 'Engineer' });
      await GET(request);

      // \ should be escaped as \\
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('company', 'Tech\\\\Corp');
    });
  });
});
