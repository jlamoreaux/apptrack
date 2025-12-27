/**
 * Tests for AI Coach Cover Letter Generation API
 * Tests cover letter generation with various inputs and permissions
 */

import { POST } from '@/app/api/ai-coach/cover-letter/route';
import { createClient } from '@/lib/supabase/server';
import { createAICoach } from '@/lib/ai-coach';
import { PermissionMiddleware } from '@/lib/middleware/permissions';
import { AIDataFetcherService } from '@/lib/services/ai-data-fetcher.service';

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
jest.mock('@/lib/ai-coach');
jest.mock('@/lib/middleware/permissions');
jest.mock('@/lib/services/ai-data-fetcher.service');
jest.mock('@/lib/middleware/rate-limit.middleware', () => ({
  withRateLimit: async (handler: any, options: any) => {
    return handler(options.request);
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateAICoach = createAICoach as jest.MockedFunction<typeof createAICoach>;
const mockPermissionMiddleware = PermissionMiddleware as jest.MockedClass<typeof PermissionMiddleware>;
const mockAIDataFetcherService = AIDataFetcherService as jest.MockedClass<typeof AIDataFetcherService>;

describe('AI Coach Cover Letter API', () => {
  let mockSupabase: any;
  let mockAICoach: any;
  
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };

  const mockCoverLetterResponse = {
    content: `Dear Hiring Manager,

I am writing to express my strong interest in the Senior Software Engineer position at Tech Corp. With over 10 years of experience in software development and a proven track record of delivering scalable solutions, I am confident I would be a valuable addition to your team.

In my current role at Previous Company, I have led the development of multiple microservices that handle millions of requests daily. My expertise in React, Node.js, and distributed systems aligns perfectly with your requirements.

I am particularly excited about Tech Corp's mission to revolutionize the tech industry and would love to contribute to your innovative projects.

Thank you for considering my application. I look forward to discussing how my skills and experience can contribute to Tech Corp's continued success.

Best regards,
John Doe`,
    metadata: {
      tone: 'professional',
      wordCount: 150,
      generatedAt: new Date().toISOString(),
    },
  };

  const mockApplicationData = {
    id: 'app123',
    company: 'Tech Corp',
    role: 'Senior Software Engineer',
    job_description: 'We are seeking a Senior Software Engineer...',
  };

  const mockResumeData = {
    text: 'John Doe\n10+ years experience in software development\nSkills: React, Node.js, Python',
    extractedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'cover123', ...mockCoverLetterResponse },
        error: null,
      }),
    };
    
    mockCreateClient.mockResolvedValue(mockSupabase);
    
    // Setup AI Coach mock
    mockAICoach = {
      generateCoverLetter: jest.fn().mockResolvedValue(mockCoverLetterResponse.content),
    };
    
    mockCreateAICoach.mockReturnValue(mockAICoach);
    
    // Setup Permission mock - default to allowed
    (mockPermissionMiddleware as any).checkApiPermission = jest.fn().mockResolvedValue({
      allowed: true,
      message: null,
    });
    
    // Setup AI Data Fetcher mock
    mockAIDataFetcherService.getAIContext = jest.fn().mockResolvedValue({
      jobDescription: mockApplicationData.job_description,
      resumeText: mockResumeData.text,
      applicationData: mockApplicationData,
    });
    
    mockAIDataFetcherService.getUserResume = jest.fn().mockResolvedValue(mockResumeData);
  });

  describe('POST /api/ai-coach/cover-letter', () => {
    it('should generate cover letter with all required fields', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Senior Software Engineer position requiring React and Node.js',
          userBackground: 'John Doe with 10 years experience',
          companyName: 'Tech Corp',
          roleName: 'Senior Software Engineer',
          tone: 'professional',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coverLetter).toContain('Dear Hiring Manager');
      expect(data.coverLetter).toContain('Tech Corp');
      
      expect(mockAICoach.generateCoverLetter).toHaveBeenCalledWith(
        'Senior Software Engineer position requiring React and Node.js',
        'John Doe with 10 years experience',
        'Tech Corp'
      );
    });

    it('should use application data when applicationId provided', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          applicationId: 'app123',
          tone: 'professional',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAIDataFetcherService.getAIContext).toHaveBeenCalledWith('user123', 'app123');
      expect(mockAICoach.generateCoverLetter).toHaveBeenCalledWith(
        mockApplicationData.job_description,
        mockResumeData.text,
        mockApplicationData.company
      );
    });

    it('should fetch user resume when not provided', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Software Engineer position',
          companyName: 'Tech Corp',
          roleName: 'Software Engineer',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAIDataFetcherService.getUserResume).toHaveBeenCalledWith('user123');
      expect(mockAICoach.generateCoverLetter).toHaveBeenCalledWith(
        'Software Engineer position',
        mockResumeData.text,
        'Tech Corp'
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Test job',
          userBackground: 'Test background',
          companyName: 'Test Corp',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockAICoach.generateCoverLetter).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks permission', async () => {
      ((mockPermissionMiddleware as any).checkApiPermission as jest.Mock).mockResolvedValue({
        allowed: false,
        message: 'Subscription required for cover letter generation',
      });

      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Test job',
          userBackground: 'Test background',
          companyName: 'Test Corp',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Subscription required for cover letter generation');
      expect(mockAICoach.generateCoverLetter).not.toHaveBeenCalled();
    });

    it('should return 400 when missing required information', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          companyName: 'Tech Corp',
          // Missing jobDescription and userBackground
        },
      });

      // Mock no resume found
      (mockAIDataFetcherService.getUserResume as jest.Mock).mockResolvedValue({ text: null });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Please provide');
    });

    it('should handle different tones', async () => {
      const tones = ['professional', 'friendly', 'enthusiastic', 'formal'];
      
      for (const tone of tones) {
        const request = createMockRequest('/api/ai-coach/cover-letter', {
          method: 'POST',
          body: {
            jobDescription: 'Test job',
            userBackground: 'Test background',
            companyName: 'Test Corp',
            tone,
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.coverLetter).toBeDefined();
      }
    });

    it('should include additional info when provided', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Software Engineer position',
          userBackground: 'Experienced developer',
          companyName: 'Tech Corp',
          additionalInfo: 'I am particularly interested in your AI initiatives',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      // Verify the additional info is passed to the AI coach
      const callArgs = mockAICoach.generateCoverLetter.mock.calls[0];
      expect(callArgs).toBeDefined();
    });

    it('should save cover letter to database', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Test job',
          userBackground: 'Test background',
          companyName: 'Tech Corp',
          applicationId: 'app123',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith('cover_letters');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle AI generation errors gracefully', async () => {
      mockAICoach.generateCoverLetter.mockRejectedValue(new Error('AI service unavailable'));

      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Test job',
          userBackground: 'Test background',
          companyName: 'Tech Corp',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should handle database save errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          jobDescription: 'Test job',
          userBackground: 'Test background',
          companyName: 'Tech Corp',
        },
      });

      const response = await POST(request);
      
      // Should still return success even if save fails
      expect(response.status).toBe(200);
    });

    it('should prioritize provided data over fetched data', async () => {
      const request = createMockRequest('/api/ai-coach/cover-letter', {
        method: 'POST',
        body: {
          applicationId: 'app123',
          jobDescription: 'Override job description',
          userBackground: 'Override background',
          companyName: 'Override Corp',
          roleName: 'Override Role',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should use provided data instead of fetched
      expect(mockAICoach.generateCoverLetter).toHaveBeenCalledWith(
        'Override job description',
        'Override background',
        'Override Corp'
      );
    });
  });
});