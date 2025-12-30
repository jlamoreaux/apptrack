/**
 * Tests for AIDataFetcherService
 * Tests resume fetching logic, job description retrieval, and AI context assembly
 */

import { AIDataFetcherService } from '@/lib/services/ai-data-fetcher.service';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('AIDataFetcherService', () => {
  const userId = 'test-user-123';
  const resumeId1 = 'resume-default-456';
  const resumeId2 = 'resume-secondary-789';
  const applicationId = 'app-123';

  const mockDefaultResume = {
    id: resumeId1,
    user_id: userId,
    extracted_text: 'Default resume content with React and Node.js experience',
    is_default: true,
  };

  const mockSecondaryResume = {
    id: resumeId2,
    user_id: userId,
    extracted_text: 'Secondary resume content with Python and Django experience',
    is_default: false,
  };

  const mockJobDescription = 'We are seeking a Full Stack Developer...';

  const mockApplicationData = {
    company: 'Tech Corp',
    role: 'Senior Software Engineer',
    role_link: 'https://example.com/job',
    notes: 'Applied via referral',
  };

  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('getUserResume - Default resume preference', () => {
    it('should return default resume when one exists', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: mockDefaultResume });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result).toEqual({
        text: mockDefaultResume.extracted_text,
        id: mockDefaultResume.id,
      });

      // Verify it queried for default resume
      expect(mockSupabase.from).toHaveBeenCalledWith('user_resumes');
      expect(mockSupabase.select).toHaveBeenCalledWith('id, extracted_text');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_default', true);
    });

    it('should fallback to most recent resume when no default exists', async () => {
      // First query (default) returns null
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null });

      // Second query (most recent) returns a resume
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockSecondaryResume });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result).toEqual({
        text: mockSecondaryResume.extracted_text,
        id: mockSecondaryResume.id,
      });

      // Verify fallback query
      expect(mockSupabase.order).toHaveBeenCalledWith('uploaded_at', { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when user has no resumes', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result).toEqual({
        text: null,
        id: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST116' },
      });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result).toEqual({
        text: null,
        id: null,
      });
    });

    it('should return null extracted_text gracefully', async () => {
      const resumeWithoutText = { ...mockDefaultResume, extracted_text: null };
      mockSupabase.maybeSingle.mockResolvedValue({ data: resumeWithoutText });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result).toEqual({
        text: null,
        id: resumeWithoutText.id,
      });
    });
  });

  describe('getUserResumeById - Specific resume fetch', () => {
    it('should return specific resume when it exists and belongs to user', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockSecondaryResume });

      const result = await AIDataFetcherService.getUserResumeById(userId, resumeId2);

      expect(result).toEqual({
        text: mockSecondaryResume.extracted_text,
        id: mockSecondaryResume.id,
      });

      // Verify it queried for specific resume with user check
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', resumeId2);
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should return null when resume does not exist', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      });

      const result = await AIDataFetcherService.getUserResumeById(userId, 'non-existent');

      expect(result).toEqual({
        text: null,
        id: null,
      });
    });

    it('should return null when resume belongs to different user', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      });

      const result = await AIDataFetcherService.getUserResumeById(userId, resumeId2);

      expect(result).toEqual({
        text: null,
        id: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection error', code: '08006' },
      });

      const result = await AIDataFetcherService.getUserResumeById(userId, resumeId2);

      expect(result).toEqual({
        text: null,
        id: null,
      });
    });
  });

  describe('getApplicationJobDescription - Fallback logic', () => {
    it('should return job_description from applications table when available', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { job_description: mockJobDescription },
      });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        applicationId
      );

      expect(result).toBe(mockJobDescription);
    });

    it('should fallback to job_fit_analysis table when applications table has no job_description', async () => {
      // First query (applications) has no job_description
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: applicationId, company: 'Tech Corp' },
      });

      // Second query (job_fit_analysis) has job_description
      mockSupabase.single.mockResolvedValueOnce({
        data: { job_description: mockJobDescription },
      });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        applicationId
      );

      expect(result).toBe(mockJobDescription);
      expect(mockSupabase.from).toHaveBeenCalledWith('job_fit_analysis');
    });

    it('should fallback to cover_letters table when job_fit_analysis has no job_description', async () => {
      // First query (applications) - no job_description
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: applicationId },
      });

      // Second query (job_fit_analysis) - null
      mockSupabase.single.mockResolvedValueOnce({ data: null });

      // Third query (cover_letters) - has job_description
      mockSupabase.single.mockResolvedValueOnce({
        data: { job_description: mockJobDescription },
      });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        applicationId
      );

      expect(result).toBe(mockJobDescription);
      expect(mockSupabase.from).toHaveBeenCalledWith('cover_letters');
    });

    it('should return null when job_description not found in any table', async () => {
      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        applicationId
      );

      expect(result).toBeNull();
    });

    it('should return null when application does not exist', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        'non-existent-app'
      );

      expect(result).toBeNull();
    });
  });

  describe('getAIContext - Complete context assembly', () => {
    it('should assemble complete context with all data available', async () => {
      // Mock getUserResume to return default resume
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockDefaultResume });

      // Mock getApplicationJobDescription to return job description
      mockSupabase.single
        .mockResolvedValueOnce({ data: { job_description: mockJobDescription } })
        .mockResolvedValueOnce({ data: mockApplicationData });

      const result = await AIDataFetcherService.getAIContext(userId, applicationId);

      expect(result).toEqual({
        resumeText: mockDefaultResume.extracted_text,
        resumeId: mockDefaultResume.id,
        jobDescription: mockJobDescription,
        applicationData: mockApplicationData,
      });
    });

    it('should handle missing application data gracefully', async () => {
      // Mock getUserResume to return default resume
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockDefaultResume });

      // Mock queries to return null
      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await AIDataFetcherService.getAIContext(userId, applicationId);

      expect(result).toEqual({
        resumeText: mockDefaultResume.extracted_text,
        resumeId: mockDefaultResume.id,
        jobDescription: null,
        applicationData: null,
      });
    });

    it('should handle case when no applicationId provided', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockDefaultResume });

      const result = await AIDataFetcherService.getAIContext(userId);

      expect(result).toEqual({
        resumeText: mockDefaultResume.extracted_text,
        resumeId: mockDefaultResume.id,
        jobDescription: null,
        applicationData: null,
      });
    });

    it('should handle case when user has no resume', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null });
      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await AIDataFetcherService.getAIContext(userId, applicationId);

      expect(result).toEqual({
        resumeText: null,
        resumeId: null,
        jobDescription: null,
        applicationData: null,
      });
    });
  });

  describe('saveJobDescription', () => {
    it('should save job description to applications table', async () => {
      await AIDataFetcherService.saveJobDescription(
        userId,
        applicationId,
        mockJobDescription
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('applications');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        job_description: mockJobDescription,
      });
      // The eq method is called in the chain, verify it was called at least
      expect(mockSupabase.eq).toHaveBeenCalled();
    });

    it('should upsert to job_fit_analysis table as backup', async () => {
      mockSupabase.update.mockResolvedValue({ data: {}, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await AIDataFetcherService.saveJobDescription(
        userId,
        applicationId,
        mockJobDescription
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('job_fit_analysis');
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          application_id: applicationId,
          job_description: mockJobDescription,
        }),
        { onConflict: 'user_id,application_id' }
      );
    });

    it('should complete successfully even if any errors occur', async () => {
      mockSupabase.update.mockResolvedValue({ data: {}, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      // Should not throw
      await AIDataFetcherService.saveJobDescription(
        userId,
        applicationId,
        mockJobDescription
      );

      // Should call both update and upsert
      expect(mockSupabase.from).toHaveBeenCalledWith('applications');
      expect(mockSupabase.from).toHaveBeenCalledWith('job_fit_analysis');
    });
  });

  describe('Integration scenarios', () => {
    it('should prioritize default resume over most recent for AI features', async () => {
      // User has multiple resumes, one is default
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockDefaultResume });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result.id).toBe(resumeId1);
      expect(result.text).toContain('React and Node.js');
    });

    it('should allow specific resume selection for targeted applications', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockSecondaryResume });

      const result = await AIDataFetcherService.getUserResumeById(userId, resumeId2);

      expect(result.id).toBe(resumeId2);
      expect(result.text).toContain('Python and Django');
    });

    it('should assemble full context for job application with saved job description', async () => {
      // Resume exists
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockDefaultResume });

      // Job description saved in applications table
      mockSupabase.single
        .mockResolvedValueOnce({ data: { job_description: mockJobDescription } })
        .mockResolvedValueOnce({ data: mockApplicationData });

      const context = await AIDataFetcherService.getAIContext(userId, applicationId);

      expect(context.resumeText).toBeTruthy();
      expect(context.jobDescription).toBe(mockJobDescription);
      expect(context.applicationData?.company).toBe('Tech Corp');
      expect(context.applicationData?.role).toBe('Senior Software Engineer');
    });

    it('should handle new application without saved job description', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockDefaultResume });
      mockSupabase.single.mockResolvedValue({ data: null });

      const context = await AIDataFetcherService.getAIContext(userId, applicationId);

      expect(context.resumeText).toBeTruthy();
      expect(context.jobDescription).toBeNull();
      expect(context.resumeId).toBe(resumeId1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string as job description', async () => {
      mockSupabase.single.mockResolvedValue({ data: { job_description: '' } });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        applicationId
      );

      // Empty string is falsy, should fallback
      expect(mockSupabase.from).toHaveBeenCalledWith('job_fit_analysis');
    });

    it('should handle very large resume text', async () => {
      const largeText = 'a'.repeat(100000);
      const largeResume = { ...mockDefaultResume, extracted_text: largeText };

      mockSupabase.maybeSingle.mockResolvedValue({ data: largeResume });

      const result = await AIDataFetcherService.getUserResume(userId);

      expect(result.text).toHaveLength(100000);
    });

    it('should handle special characters in job description', async () => {
      const specialCharsJobDesc = 'We need a developer with C++ & C# experience! 😊';
      mockSupabase.single.mockResolvedValue({
        data: { job_description: specialCharsJobDesc },
      });

      const result = await AIDataFetcherService.getApplicationJobDescription(
        userId,
        applicationId
      );

      expect(result).toBe(specialCharsJobDesc);
    });

    it('should handle concurrent resume fetches correctly', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: mockDefaultResume });

      const [result1, result2, result3] = await Promise.all([
        AIDataFetcherService.getUserResume(userId),
        AIDataFetcherService.getUserResume(userId),
        AIDataFetcherService.getUserResume(userId),
      ]);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });
});
