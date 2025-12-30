/**
 * Tests for Resume Management API Routes
 * Tests multi-resume upload, limits, default setting, and deletion
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server-client', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/services/resumes', () => ({
  ResumeService: jest.fn().mockImplementation(() => ({
    canAddResume: jest.fn(),
    getAllResumes: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setDefaultResume: jest.fn(),
  })),
}));

// Mock text extraction to avoid pdf-parse loading issues
jest.mock('@/lib/utils/text-extraction-server', () => ({
  extractTextFromBuffer: jest.fn(),
  isSupportedFileType: jest.fn().mockReturnValue(true),
}));

// Mock pdf-parse to prevent it from running debug code
jest.mock('pdf-parse', () => jest.fn());

// Now import after mocks are set up
import { POST } from '@/app/api/resume/upload/route';
import { GET as CheckLimitGET } from '@/app/api/resume/check-limit/route';
import { GET as ListGET } from '@/app/api/resume/list/route';
import { PATCH, DELETE } from '@/app/api/resume/[id]/route';
import { PATCH as SetDefaultPATCH } from '@/app/api/resume/[id]/default/route';
import { createClient } from '@/lib/supabase/server';
import { ResumeService } from '@/services/resumes';
import { extractTextFromBuffer } from '@/lib/utils/text-extraction-server';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockExtractText = extractTextFromBuffer as jest.MockedFunction<typeof extractTextFromBuffer>;

// Helper to get the mocked resume service instance
const getMockResumeService = () => {
  const ResumeServiceConstructor = ResumeService as any;
  const instance = new ResumeServiceConstructor();
  return instance;
};

describe('Resume Management API Routes', () => {
  let mockSupabase: any;
  let mockResumeServiceInstance: any;
  const userId = 'test-user-123';
  const resumeId = 'resume-456';

  const mockUser = {
    id: userId,
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01',
  };

  const mockResume = {
    id: resumeId,
    user_id: userId,
    name: 'My Resume',
    description: 'Software Engineer Resume',
    file_url: 'https://example.com/resume.pdf',
    file_type: 'application/pdf',
    extracted_text: 'Resume content here',
    is_default: true,
    display_order: 1,
    uploaded_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ data: { path: 'resumes/test.pdf' }, error: null }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/resume.pdf' },
          }),
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('POST /api/resume/upload - Multi-resume support', () => {
    const createFormData = (overrides?: any) => {
      const file = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      if (overrides?.name) formData.append('name', overrides.name);
      if (overrides?.description) formData.append('description', overrides.description);
      if (overrides?.setAsDefault !== undefined) formData.append('setAsDefault', String(overrides.setAsDefault));
      return formData;
    };

    it('should upload first resume and auto-set as default', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content here',
      });

      // Mock: user has 0 resumes
      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
        plan: 'Free',
      });

      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([]);
      (new ResumeService() as any).create = jest.fn().mockResolvedValue(mockResume);

      const formData = createFormData();
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resume.is_default).toBe(true);
      expect((new ResumeService() as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          is_default: true,
        })
      );
    });

    it('should respect setAsDefault parameter', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content here',
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 1,
        plan: 'AI Coach',
      });

      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([mockResume]);
      (new ResumeService() as any).create = jest.fn().mockResolvedValue({
        ...mockResume,
        id: 'resume-789',
        is_default: false,
      });

      const formData = createFormData({ setAsDefault: 'false' });
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resume.is_default).toBe(false);
    });

    it('should use custom name when provided', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content here',
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 0,
        plan: 'AI Coach',
      });

      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([]);
      (new ResumeService() as any).create = jest.fn().mockResolvedValue({
        ...mockResume,
        name: 'Senior SWE Resume',
      });

      const formData = createFormData({ name: 'Senior SWE Resume' });
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect((new ResumeService() as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Senior SWE Resume',
        })
      );
    });

    it('should auto-generate name from filename when not provided', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content here',
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 0,
        plan: 'AI Coach',
      });

      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([]);
      (new ResumeService() as any).create = jest.fn().mockResolvedValue(mockResume);

      const formData = createFormData();
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      await POST(request);

      expect((new ResumeService() as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'resume', // filename without extension
        })
      );
    });

    it('should block free users from uploading 2nd resume', async () => {
      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: false,
        limit: 1,
        current: 1,
        plan: 'Free',
      });

      const formData = createFormData();
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Resume limit reached');
      expect(data.limit).toBe(1);
      expect(data.current).toBe(1);
      expect(data.plan).toBe('Free');
    });

    it('should allow AI Coach users to upload up to 100 resumes', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content here',
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 50,
        plan: 'AI Coach',
      });

      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue(
        Array(50).fill(mockResume)
      );
      (new ResumeService() as any).create = jest.fn().mockResolvedValue(mockResume);

      const formData = createFormData();
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should set correct display_order for new resumes', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content here',
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 3,
        plan: 'AI Coach',
      });

      const existingResumes = [
        { ...mockResume, display_order: 1 },
        { ...mockResume, display_order: 2 },
        { ...mockResume, display_order: 3 },
      ];
      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue(existingResumes);
      (new ResumeService() as any).create = jest.fn().mockResolvedValue(mockResume);

      const formData = createFormData();
      const request = new Request('http://localhost:3000/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      await POST(request);

      expect((new ResumeService() as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          display_order: 4, // Max order + 1
        })
      );
    });
  });

  describe('GET /api/resume/check-limit', () => {
    it('should return limit info for free user', async () => {
      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: false,
        limit: 1,
        current: 1,
        plan: 'Free',
      });

      const request = new Request('http://localhost:3000/api/resume/check-limit');
      const response = await CheckLimitGET();
      const data = await response.json();

      expect(data).toEqual({
        allowed: false,
        limit: 1,
        current: 1,
        plan: 'Free',
      });
    });

    it('should return limit info for AI Coach user', async () => {
      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 25,
        plan: 'AI Coach',
      });

      const request = new Request('http://localhost:3000/api/resume/check-limit');
      const response = await CheckLimitGET();
      const data = await response.json();

      expect(data).toEqual({
        allowed: true,
        limit: 100,
        current: 25,
        plan: 'AI Coach',
      });
    });
  });

  describe('GET /api/resume/list', () => {
    it('should return all resumes sorted by display_order', async () => {
      const resumes = [
        { ...mockResume, id: 'resume-1', display_order: 1 },
        { ...mockResume, id: 'resume-2', display_order: 2 },
        { ...mockResume, id: 'resume-3', display_order: 3 },
      ];

      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue(resumes);
      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 100,
        current: 3,
        plan: 'AI Coach',
      });

      const response = await ListGET();
      const data = await response.json();

      expect(data.resumes).toHaveLength(3);
      expect(data.resumes[0].display_order).toBe(1);
      expect(data.limit).toEqual({
        allowed: true,
        limit: 100,
        current: 3,
        plan: 'AI Coach',
      });
    });

    it('should return empty array when user has no resumes', async () => {
      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([]);
      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
        plan: 'Free',
      });

      const response = await ListGET();
      const data = await response.json();

      expect(data.resumes).toEqual([]);
      expect(data.limit.current).toBe(0);
    });
  });

  describe('PATCH /api/resume/[id]/default', () => {
    it('should set resume as default', async () => {
      (new ResumeService() as any).setDefaultResume = jest.fn().mockResolvedValue({
        ...mockResume,
        is_default: true,
      });

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await SetDefaultPATCH(new Request('http://localhost'), params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resume.is_default).toBe(true);
      expect((new ResumeService() as any).setDefaultResume).toHaveBeenCalledWith(resumeId, userId);
    });

    it('should return 404 when resume not found', async () => {
      (new ResumeService() as any).setDefaultResume = jest.fn().mockResolvedValue(null);

      const params = { params: Promise.resolve({ id: 'non-existent' }) };
      const response = await SetDefaultPATCH(new Request('http://localhost'), params);

      expect(response.status).toBe(404);
    });

    it('should return 401 when user not authenticated', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await SetDefaultPATCH(new Request('http://localhost'), params);

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/resume/[id] - Update metadata', () => {
    it('should update resume name and description', async () => {
      (new ResumeService() as any).update = jest.fn().mockResolvedValue({
        ...mockResume,
        name: 'Updated Name',
        description: 'Updated description',
      });

      const request = new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Updated Name',
          description: 'Updated description',
        }),
      });

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await PATCH(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resume.name).toBe('Updated Name');
      expect(data.resume.description).toBe('Updated description');
    });

    it('should update display_order', async () => {
      (new ResumeService() as any).update = jest.fn().mockResolvedValue({
        ...mockResume,
        display_order: 5,
      });

      const request = new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ display_order: 5 }),
      });

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await PATCH(request, params);
      const data = await response.json();

      expect(data.resume.display_order).toBe(5);
    });
  });

  describe('DELETE /api/resume/[id] - Safety checks', () => {
    it('should delete non-default resume successfully', async () => {
      (new ResumeService() as any).findById = jest.fn().mockResolvedValue({
        ...mockResume,
        is_default: false,
      });
      (new ResumeService() as any).delete = jest.fn().mockResolvedValue(true);

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await DELETE(new Request('http://localhost'), params);

      expect(response.status).toBe(200);
      expect((new ResumeService() as any).delete).toHaveBeenCalledWith(resumeId);
    });

    it('should block deletion of last default resume', async () => {
      (new ResumeService() as any).findById = jest.fn().mockResolvedValue({
        ...mockResume,
        is_default: true,
      });
      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([mockResume]);

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await DELETE(new Request('http://localhost'), params);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Cannot delete');
    });

    it('should allow deletion of default resume when user has other resumes', async () => {
      const otherResume = { ...mockResume, id: 'resume-789', is_default: false };

      (new ResumeService() as any).findById = jest.fn().mockResolvedValue(mockResume);
      (new ResumeService() as any).getAllResumes = jest.fn().mockResolvedValue([
        mockResume,
        otherResume,
      ]);
      (new ResumeService() as any).delete = jest.fn().mockResolvedValue(true);

      const params = { params: Promise.resolve({ id: resumeId }) };
      const response = await DELETE(new Request('http://localhost'), params);

      expect(response.status).toBe(200);
    });

    it('should return 404 when resume does not exist', async () => {
      (new ResumeService() as any).findById = jest.fn().mockResolvedValue(null);

      const params = { params: Promise.resolve({ id: 'non-existent' }) };
      const response = await DELETE(new Request('http://localhost'), params);

      expect(response.status).toBe(404);
    });
  });

  describe('Authorization checks', () => {
    it('should return 401 for unauthenticated upload request', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const formData = new FormData();
      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      const request = new Request('http://localhost/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated list request', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await ListGET();

      expect(response.status).toBe(401);
    });
  });

  describe('Edge cases', () => {
    it('should handle file size limit exceeded', async () => {
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });
      const formData = new FormData();
      formData.append('file', largeFile);

      const request = new Request('http://localhost/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
        plan: 'Free',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('5MB');
    });

    it('should handle unsupported file type', async () => {
      const file = new File(['content'], 'resume.exe', { type: 'application/x-msdownload' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
        plan: 'Free',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('PDF, Word document');
    });

    it('should handle text extraction failure', async () => {
      mockExtractText.mockResolvedValue({
        success: false,
        error: 'Could not extract text',
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
        plan: 'Free',
      });

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('extract text');
    });

    it('should handle storage upload failure', async () => {
      mockExtractText.mockResolvedValue({
        success: true,
        text: 'Resume content',
      });

      mockSupabase.storage.from().upload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage quota exceeded', name: 'StorageError' },
      });

      (new ResumeService() as any).canAddResume = jest.fn().mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
        plan: 'Free',
      });

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to upload file');
    });
  });
});
