/**
 * Tests for AI Feature Resume Selection Logic
 * Tests that AI features correctly use resumeId parameter and track user_resume_id
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/ai-coach', () => ({
  createAICoach: jest.fn(),
}));

jest.mock('@/lib/services/ai-data-fetcher.service', () => ({
  AIDataFetcherService: {
    getUserResume: jest.fn(),
    getUserResumeById: jest.fn(),
    getAIContext: jest.fn(),
    saveJobDescription: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/permissions', () => ({
  PermissionMiddleware: {
    checkApiPermissionWithFreeTier: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/rate-limit.middleware', () => ({
  withRateLimit: (handler: any) => handler,
}));

jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    logSecurityEvent: jest.fn(),
    logAiServiceCall: jest.fn(),
  },
}));

jest.mock('@/lib/services/ai-feature-usage.service', () => ({
  AIFeatureUsageService: {
    trackUsage: jest.fn(),
  },
}));

// Now import after mocks
import { POST as JobFitPOST } from '@/app/api/ai-coach/job-fit/route';
import { POST as CoverLetterPOST } from '@/app/api/ai-coach/cover-letter/route';
import { AIDataFetcherService } from '@/lib/services/ai-data-fetcher.service';
import { createAICoach } from '@/lib/ai-coach';
import { createClient } from '@/lib/supabase/server';
import { PermissionMiddleware } from '@/lib/middleware/permissions';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateAICoach = createAICoach as jest.MockedFunction<typeof createAICoach>;
const mockAIDataFetcher = AIDataFetcherService as jest.Mocked<typeof AIDataFetcherService>;
const mockPermissionMiddleware = PermissionMiddleware as jest.Mocked<typeof PermissionMiddleware>;

describe('AI Feature Resume Selection Logic', () => {
  let mockSupabase: any;
  const userId = 'test-user-123';
  const defaultResumeId = 'resume-default-456';
  const specificResumeId = 'resume-specific-789';
  const applicationId = 'app-123';

  const mockUser = {
    id: userId,
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01',
  };

  const mockDefaultResume = {
    id: defaultResumeId,
    text: 'Default resume with React and Node.js experience',
  };

  const mockSpecificResume = {
    id: specificResumeId,
    text: 'Specific resume with Python and Django experience',
  };

  const mockJobDescription = 'We are seeking a Full Stack Developer with React and Node.js...';

  const mockAnalysisResult = {
    overallScore: 85,
    summary: 'Strong match',
    matchDetails: [],
    keyStrengths: [],
    areasForImprovement: [],
    recommendations: [],
  };

  const mockAICoach = {
    analyzeJobFit: jest.fn().mockResolvedValue(mockAnalysisResult),
    generateCoverLetter: jest.fn().mockResolvedValue('Mock cover letter content'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockCreateAICoach.mockReturnValue(mockAICoach as any);

    mockPermissionMiddleware.checkApiPermissionWithFreeTier = jest.fn().mockResolvedValue({
      allowed: true,
      usedFreeTier: false,
    });
  });

  describe('Job Fit Analysis - Resume Selection', () => {
    it('should use default resume when no resumeId specified', async () => {
      mockAIDataFetcher.getUserResume = jest.fn().mockResolvedValue(mockDefaultResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: null,
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          applicationId,
        }),
      });

      const response = await JobFitPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAIDataFetcher.getUserResume).toHaveBeenCalledWith(userId);
      expect(mockAICoach.analyzeJobFit).toHaveBeenCalledWith(
        mockJobDescription,
        mockDefaultResume.text
      );
    });

    it('should use specific resume when resumeId provided', async () => {
      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue(mockSpecificResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: null,
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          resumeId: specificResumeId,
          applicationId,
        }),
      });

      const response = await JobFitPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAIDataFetcher.getUserResumeById).toHaveBeenCalledWith(userId, specificResumeId);
      expect(mockAICoach.analyzeJobFit).toHaveBeenCalledWith(
        mockJobDescription,
        mockSpecificResume.text
      );
    });

    it('should track user_resume_id in database when saving analysis', async () => {
      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue(mockSpecificResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: null,
      });

      mockSupabase.single.mockResolvedValue({ data: null });
      const mockInsert = jest.fn().mockReturnThis();
      mockSupabase.insert = mockInsert;

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          resumeId: specificResumeId,
          applicationId,
        }),
      });

      await JobFitPOST(request);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          application_id: applicationId,
          user_resume_id: specificResumeId,
          job_description: mockJobDescription,
        })
      );
    });

    it('should use resume from application context when available', async () => {
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: mockDefaultResume.text,
        resumeId: defaultResumeId,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          applicationId,
        }),
      });

      const response = await JobFitPOST(request);

      expect(response.status).toBe(200);
      expect(mockAICoach.analyzeJobFit).toHaveBeenCalledWith(
        mockJobDescription,
        mockDefaultResume.text
      );
    });
  });

  describe('Cover Letter Generation - Resume Selection', () => {
    it('should use default resume when no resumeId specified', async () => {
      mockAIDataFetcher.getUserResume = jest.fn().mockResolvedValue(mockDefaultResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      mockSupabase.select = jest.fn().mockReturnThis();
      mockSupabase.single = jest.fn().mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/cover-letter', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          companyName: 'Tech Corp',
          applicationId,
        }),
      });

      const response = await CoverLetterPOST(request);

      expect(response.status).toBe(200);
      expect(mockAIDataFetcher.getUserResume).toHaveBeenCalledWith(userId);
      expect(mockAICoach.generateCoverLetter).toHaveBeenCalledWith(
        mockJobDescription,
        mockDefaultResume.text,
        'Tech Corp'
      );
    });

    it('should use specific resume when resumeId provided', async () => {
      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue(mockSpecificResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      mockSupabase.select = jest.fn().mockReturnThis();
      mockSupabase.single = jest.fn().mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/cover-letter', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          companyName: 'Tech Corp',
          resumeId: specificResumeId,
          applicationId,
        }),
      });

      const response = await CoverLetterPOST(request);

      expect(response.status).toBe(200);
      expect(mockAIDataFetcher.getUserResumeById).toHaveBeenCalledWith(userId, specificResumeId);
      expect(mockAICoach.generateCoverLetter).toHaveBeenCalledWith(
        mockJobDescription,
        mockSpecificResume.text,
        'Tech Corp'
      );
    });

    it('should track user_resume_id in database when saving cover letter', async () => {
      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue(mockSpecificResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      const mockInsert = jest.fn().mockReturnThis();
      mockSupabase.insert = mockInsert;
      mockSupabase.select = jest.fn().mockReturnThis();
      mockSupabase.single = jest.fn().mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/cover-letter', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          companyName: 'Tech Corp',
          resumeId: specificResumeId,
          applicationId,
        }),
      });

      await CoverLetterPOST(request);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          application_id: applicationId,
          user_resume_id: specificResumeId,
          company_name: 'Tech Corp',
        })
      );
    });
  });

  describe('Resume Priority Logic', () => {
    it('should prioritize: explicit resumeId > application resume > default resume', async () => {
      // Scenario 1: Explicit resumeId should win
      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue(mockSpecificResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: mockDefaultResume.text, // Application has different resume
        resumeId: defaultResumeId,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          resumeId: specificResumeId, // Explicit override
          applicationId,
        }),
      });

      await JobFitPOST(request);

      // Should use the specific resume, not the application's resume
      expect(mockAICoach.analyzeJobFit).toHaveBeenCalledWith(
        mockJobDescription,
        mockSpecificResume.text
      );
    });

    it('should use application resume when no explicit resumeId', async () => {
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: mockDefaultResume.text,
        resumeId: defaultResumeId,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          applicationId, // No explicit resumeId
        }),
      });

      await JobFitPOST(request);

      expect(mockAICoach.analyzeJobFit).toHaveBeenCalledWith(
        mockJobDescription,
        mockDefaultResume.text
      );
    });

    it('should fallback to default resume when application has no resume', async () => {
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: { company: 'Tech Corp', role: 'Engineer' },
      });

      mockAIDataFetcher.getUserResume = jest.fn().mockResolvedValue(mockDefaultResume);
      mockSupabase.single.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          applicationId,
        }),
      });

      await JobFitPOST(request);

      expect(mockAIDataFetcher.getUserResume).toHaveBeenCalledWith(userId);
      expect(mockAICoach.analyzeJobFit).toHaveBeenCalledWith(
        mockJobDescription,
        mockDefaultResume.text
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 400 when no resume found', async () => {
      mockAIDataFetcher.getUserResume = jest.fn().mockResolvedValue({
        text: null,
        id: null,
      });
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: null,
      });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
        }),
      });

      const response = await JobFitPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('resume');
    });

    it('should return 400 when specified resumeId not found', async () => {
      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue({
        text: null,
        id: null,
      });
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: null,
      });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          resumeId: 'non-existent-resume',
        }),
      });

      const response = await JobFitPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('resume');
    });

    it('should handle permission denial gracefully', async () => {
      mockPermissionMiddleware.checkApiPermissionWithFreeTier = jest.fn().mockResolvedValue({
        allowed: false,
        reason: 'subscription_required',
        message: 'AI Coach subscription required',
      });

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
        }),
      });

      const response = await JobFitPOST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('AI Coach');
    });
  });

  describe('Free Tier Usage Tracking', () => {
    it('should track which resume was used in free tier usage', async () => {
      mockPermissionMiddleware.checkApiPermissionWithFreeTier = jest.fn().mockResolvedValue({
        allowed: true,
        usedFreeTier: true,
        remainingFreeTries: 1,
      });

      mockAIDataFetcher.getUserResumeById = jest.fn().mockResolvedValue(mockSpecificResume);
      mockAIDataFetcher.getAIContext = jest.fn().mockResolvedValue({
        resumeText: null,
        resumeId: null,
        jobDescription: mockJobDescription,
        applicationData: null,
      });

      mockSupabase.single.mockResolvedValue({ data: null });
      const mockInsert = jest.fn().mockReturnThis();
      mockSupabase.insert = mockInsert;

      const request = new Request('http://localhost/api/ai-coach/job-fit', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: mockJobDescription,
          resumeId: specificResumeId,
        }),
      });

      const response = await JobFitPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usedFreeTier).toBe(true);
      expect(data.remainingFreeTries).toBe(0);

      // Verify user_resume_id was tracked in the insert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_resume_id: specificResumeId,
        })
      );
    });
  });
});
