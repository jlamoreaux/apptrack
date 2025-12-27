/**
 * Tests for Applications API endpoints
 * Tests CRUD operations for job applications
 */

import { GET } from '@/app/api/applications/route';
import { ApplicationDAL } from '@/dal/applications';
import { getUser } from '@/lib/supabase/server';

// Helper to create mock requests
function createMockRequest(path: string, options?: any) {
  const url = new URL(path, 'http://localhost:3000');
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value as string);
    });
  }
  return new (global as any).NextRequest(url.toString(), options);
}

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/dal/applications');

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockApplicationDAL = ApplicationDAL as jest.MockedClass<typeof ApplicationDAL>;

describe('Applications API', () => {
  let mockQueryApplications: jest.Mock;
  let mockGetStatusCounts: jest.Mock;
  
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };

  const mockApplications = {
    applications: [
      {
        id: 'app1',
        user_id: 'user123',
        company: 'Tech Corp',
        role: 'Software Engineer',
        status: 'Applied',
        date_applied: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        archived: false,
      },
      {
        id: 'app2',
        user_id: 'user123',
        company: 'Startup Inc',
        role: 'Senior Developer',
        status: 'Interview Scheduled',
        date_applied: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        archived: false,
      },
    ],
    totalCount: 2,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  };

  const mockStatusCounts = {
    'Applied': 5,
    'Interview Scheduled': 3,
    'Interviewed': 2,
    'Offer': 1,
    'Rejected': 4,
    'Hired': 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockQueryApplications = jest.fn().mockResolvedValue(mockApplications);
    mockGetStatusCounts = jest.fn().mockResolvedValue(mockStatusCounts);
    
    mockApplicationDAL.prototype.queryApplications = mockQueryApplications;
    mockApplicationDAL.prototype.getStatusCounts = mockGetStatusCounts;
    
    mockGetUser.mockResolvedValue(mockUser as any);
  });

  describe('GET /api/applications', () => {
    it('should return applications for authenticated user', async () => {
      const request = createMockRequest('/api/applications');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.applications).toEqual(mockApplications.applications);
      expect(data.totalCount).toBe(2);
      expect(data.statusCounts).toEqual(mockStatusCounts);
      
      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 1,
        pageSize: 25,
        sortField: 'updated_at',
        sortDirection: 'desc',
        statusFilter: [],
        includeArchived: false,
      });
    });

    it('should handle pagination parameters', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: { page: '2', pageSize: '10' }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 2,
        pageSize: 10,
        sortField: 'updated_at',
        sortDirection: 'desc',
        statusFilter: [],
        includeArchived: false,
      });
    });

    it('should handle sorting parameters', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: { sortField: 'company', sortDirection: 'asc' }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 1,
        pageSize: 25,
        sortField: 'company',
        sortDirection: 'asc',
        statusFilter: [],
        includeArchived: false,
      });
    });

    it('should handle status filter', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: { statusFilter: 'Applied,Interviewed' }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 1,
        pageSize: 25,
        sortField: 'updated_at',
        sortDirection: 'desc',
        statusFilter: ['Applied', 'Interviewed'],
        includeArchived: false,
      });
    });

    it('should handle includeArchived parameter', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: { includeArchived: 'true' }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 1,
        pageSize: 25,
        sortField: 'updated_at',
        sortDirection: 'desc',
        statusFilter: [],
        includeArchived: true,
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockGetUser.mockResolvedValue(null);
      
      const request = createMockRequest('/api/applications');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockQueryApplications).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockQueryApplications.mockRejectedValue(new Error('Database error'));
      
      const request = createMockRequest('/api/applications');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch applications');
    });

    it('should handle invalid pagination parameters', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: { page: 'invalid', pageSize: 'abc' }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: NaN,
        pageSize: NaN,
        sortField: 'updated_at',
        sortDirection: 'desc',
        statusFilter: [],
        includeArchived: false,
      });
    });

    it('should handle empty status filter', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: { statusFilter: '' }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 1,
        pageSize: 25,
        sortField: 'updated_at',
        sortDirection: 'desc',
        statusFilter: [],
        includeArchived: false,
      });
    });

    it('should handle all query parameters combined', async () => {
      const request = createMockRequest('/api/applications', {
        searchParams: {
          page: '3',
          pageSize: '15',
          sortField: 'date_applied',
          sortDirection: 'asc',
          statusFilter: 'Applied,Offer',
          includeArchived: 'true'
        }
      });
      await GET(request);

      expect(mockQueryApplications).toHaveBeenCalledWith('user123', {
        page: 3,
        pageSize: 15,
        sortField: 'date_applied',
        sortDirection: 'asc',
        statusFilter: ['Applied', 'Offer'],
        includeArchived: true,
      });
    });

    it('should fetch status counts along with applications', async () => {
      const request = createMockRequest('/api/applications');
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStatusCounts).toHaveBeenCalledWith('user123');
      expect(data.statusCounts).toEqual(mockStatusCounts);
    });

    it('should handle status counts error independently', async () => {
      mockGetStatusCounts.mockRejectedValue(new Error('Count error'));
      
      const request = createMockRequest('/api/applications');
      const response = await GET(request);

      // Should still return 500 as the whole operation failed
      expect(response.status).toBe(500);
    });
  });
});