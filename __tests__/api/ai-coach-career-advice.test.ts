/**
 * Tests for AI Coach Career Advice API
 * Tests career advice generation with conversation history
 */

import { POST } from '@/app/api/ai-coach/career-advice/route';
import { createClient } from '@/lib/supabase/server';
import { createAICoach } from '@/lib/ai-coach';
import { PermissionMiddleware } from '@/lib/middleware/permissions';

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
jest.mock('@/lib/middleware/rate-limit.middleware', () => ({
  withRateLimit: async (handler: any, options: any) => {
    return handler(options.request);
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateAICoach = createAICoach as jest.MockedFunction<typeof createAICoach>;
const mockPermissionMiddleware = PermissionMiddleware as jest.MockedClass<typeof PermissionMiddleware>;

describe('AI Coach Career Advice API', () => {
  let mockSupabase: any;
  let mockAICoach: any;
  
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };

  const mockAdviceResponse = {
    advice: `Based on your question about career transitions, I recommend focusing on the following areas:

1. **Skill Assessment**: Start by evaluating your current skills and identifying transferable ones that apply to your target role.

2. **Gap Analysis**: Determine what skills or certifications you need to acquire for your desired position.

3. **Networking**: Connect with professionals in your target field through LinkedIn and industry events.

4. **Portfolio Development**: Create projects that demonstrate your capabilities in the new domain.

5. **Gradual Transition**: Consider taking on freelance projects or side work to build experience while maintaining stability.

Remember, career transitions take time and patience. Focus on consistent progress rather than immediate results.`,
    metadata: {
      category: 'career_transition',
      confidence: 0.92,
    },
  };

  const mockConversationHistory = [
    {
      content: 'I want to transition from backend to full-stack development',
      is_user: true,
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      content: 'That\'s a great career move! Full-stack development offers more versatility...',
      is_user: false,
      created_at: '2024-01-01T10:01:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ 
          data: { user: mockUser },
          error: null 
        }),
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: mockConversationHistory,
        error: null,
      }),
    };
    
    mockCreateClient.mockResolvedValue(mockSupabase);
    
    // Setup AI Coach mock
    mockAICoach = {
      askCareerQuestion: jest.fn().mockResolvedValue(mockAdviceResponse.advice),
    };
    
    mockCreateAICoach.mockReturnValue(mockAICoach);
    
    // Setup Permission mock - default to allowed
    (mockPermissionMiddleware as any).checkApiPermission = jest.fn().mockResolvedValue({
      allowed: true,
      message: null,
    });
  });

  describe('POST /api/ai-coach/career-advice', () => {
    it('should generate career advice for a valid question', async () => {
      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'How do I transition from backend to full-stack development?',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toContain('Skill Assessment');
      expect(data.response).toContain('career transitions');
      
      expect(mockAICoach.askCareerQuestion).toHaveBeenCalledWith(
        'How do I transition from backend to full-stack development?',
        []
      );
      
      // Verify messages were saved to database
      expect(mockSupabase.from).toHaveBeenCalledWith('career_advice');
      expect(mockSupabase.insert).toHaveBeenCalledTimes(2); // User message and AI response
    });

    it('should include conversation history when provided', async () => {
      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'What specific frontend frameworks should I learn?',
          conversationHistory: mockConversationHistory,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAICoach.askCareerQuestion).toHaveBeenCalledWith(
        'What specific frontend frameworks should I learn?',
        mockConversationHistory
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: null },
        error: null 
      });

      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'Career question',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockAICoach.askCareerQuestion).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks permission', async () => {
      ((mockPermissionMiddleware as any).checkApiPermission as jest.Mock).mockResolvedValue({
        allowed: false,
        message: 'Upgrade to AI Coach plan for career advice',
      });

      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'Career question',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Upgrade to AI Coach plan for career advice');
      expect(mockAICoach.askCareerQuestion).not.toHaveBeenCalled();
    });

    it('should return 400 when message is missing', async () => {
      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          // No message provided
          conversationHistory: [],
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Please enter your question');
      expect(mockAICoach.askCareerQuestion).not.toHaveBeenCalled();
    });

    it('should handle empty message gracefully', async () => {
      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: '',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Please enter your question');
    });

    it('should handle different response formats from AI coach', async () => {
      // Test string response (already returns string)
      mockAICoach.askCareerQuestion.mockResolvedValue('Simple text response');
      
      let request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: { message: 'Question 1' },
      });

      let response = await POST(request);
      let data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toBe('Simple text response');

      // Test returning string directly
      mockAICoach.askCareerQuestion.mockResolvedValue('Response with message field');
      
      request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: { message: 'Question 2' },
      });

      response = await POST(request);
      data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toBe('Response with message field');

      // Test returning complex string
      mockAICoach.askCareerQuestion.mockResolvedValue(
        JSON.stringify({ data: 'complex', nested: { field: 'value' }})
      );
      
      request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: { message: 'Question 3' },
      });

      response = await POST(request);
      data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toContain('complex');
    });

    it('should continue working even if database save fails', async () => {
      mockSupabase.insert.mockResolvedValue({ 
        error: { message: 'Database error' } 
      });

      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'Should work despite DB error',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return successful response
      expect(response.status).toBe(200);
      expect(data.response).toBeDefined();
    });

    it('should handle AI coach errors gracefully', async () => {
      mockAICoach.askCareerQuestion.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'This will fail',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to get career advice');
    });

    it('should handle long conversation histories', async () => {
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        content: `Message ${i}`,
        is_user: i % 2 === 0,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }));

      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'Question with long history',
          conversationHistory: longHistory,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAICoach.askCareerQuestion).toHaveBeenCalledWith(
        'Question with long history',
        longHistory
      );
    });

    it('should save messages with proper structure', async () => {
      const request = createMockRequest('/api/ai-coach/career-advice', {
        method: 'POST',
        body: {
          message: 'Test message for DB structure',
        },
      });

      await POST(request);

      // Check user message save
      const userMessageCall = mockSupabase.insert.mock.calls[0][0];
      expect(userMessageCall).toEqual({
        user_id: 'user123',
        content: 'Test message for DB structure',
        is_user: true,
        created_at: expect.any(String),
      });

      // Check AI response save
      const aiMessageCall = mockSupabase.insert.mock.calls[1][0];
      expect(aiMessageCall).toEqual({
        user_id: 'user123',
        content: expect.stringContaining('Skill Assessment'),
        is_user: false,
        created_at: expect.any(String),
      });
    });

    it('should handle various career-related questions', async () => {
      const questions = [
        'How do I negotiate a better salary?',
        'What skills are most in demand for 2024?',
        'Should I pursue a management or technical career path?',
        'How do I prepare for technical interviews?',
        'What certifications would help my career?',
      ];

      for (const question of questions) {
        mockAICoach.askCareerQuestion.mockResolvedValue(
          `Personalized response for: ${question}`
        );

        const request = createMockRequest('/api/ai-coach/career-advice', {
          method: 'POST',
          body: { message: question },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.response).toContain('Personalized response');
      }
    });
  });
});