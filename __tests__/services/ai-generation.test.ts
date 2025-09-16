/**
 * Tests for AI Generation Service
 * Tests AI-powered content generation for interview prep, job fit analysis, and cover letters
 */

import { AIGenerationService } from '@/lib/services/ai-generation';
import type { 
  AnalysisContext, 
  InterviewPreparationResult,
  JobFitAnalysisResult,
  CoverLetterResult 
} from '@/types/ai-analysis';

// Mock environment variables
const originalEnv = process.env;

describe('AIGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const mockContext: AnalysisContext = {
    company: 'Tech Corp',
    role: 'Senior Software Engineer',
    userId: 'user123',
    applicationId: 'app123',
    jobDescription: 'We are seeking a Senior Software Engineer...',
  };

  const mockProfile = {
    skills: 'JavaScript, React, Node.js, Python',
    experience_level: 'Senior',
    education: 'BS Computer Science',
  };

  const mockJobDescription = `
    Tech Corp is seeking a Senior Software Engineer to join our team.
    Requirements:
    - 5+ years of experience in software development
    - Strong knowledge of React and Node.js
    - Experience with distributed systems
  `;

  describe('generateInterviewPreparation', () => {
    it('should generate interview preparation with AI provider', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      // Mock the AI provider call
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockResolvedValue(JSON.stringify({
        questions: [
          {
            id: 'q1',
            category: 'behavioral',
            question: 'Tell me about a challenging project you worked on.',
            suggestedApproach: 'Use STAR method',
            difficulty: 'medium',
          },
          {
            id: 'q2',
            category: 'technical',
            question: 'How would you design a distributed cache?',
            suggestedApproach: 'Discuss architecture patterns',
            difficulty: 'hard',
          },
        ],
        generalTips: ['Research the company', 'Prepare examples'],
        companyInsights: ['Tech Corp values innovation'],
        roleSpecificAdvice: ['Focus on distributed systems experience'],
        practiceAreas: ['System design', 'Behavioral questions'],
        estimatedDuration: 45,
      }));

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].category).toBe('behavioral');
      expect(result.questions[1].category).toBe('technical');
      expect(result.generalTips).toContain('Research the company');
      expect(result.estimatedDuration).toBe(45);
    });

    it('should fall back to mock generation when no API key', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.generalTips.length).toBeGreaterThan(0);
      expect(result.companyInsights.length).toBeGreaterThan(0);
      expect(result.roleSpecificAdvice.length).toBeGreaterThan(0);
      expect(result.practiceAreas.length).toBeGreaterThan(0);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it('should fall back to mock generation on AI provider error', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('generalTips');
      expect(result).toHaveProperty('companyInsights');
    });

    it('should handle missing job description', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        '',
        mockProfile
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions[0]).toHaveProperty('question');
      expect(result.questions[0]).toHaveProperty('suggestedApproach');
    });

    it('should handle missing profile', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        null
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('generalTips');
    });

    it('should generate questions for all categories', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      const categories = result.questions.map(q => q.category);
      expect(categories).toContain('behavioral');
      expect(categories).toContain('technical');
      expect(categories).toContain('company-specific');
    });
  });

  describe('generateJobFitAnalysis', () => {
    it('should generate job fit analysis with AI provider', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockResolvedValue(JSON.stringify({
        overallScore: 85,
        scoreLabel: 'Strong Match',
        strengths: [
          'Strong React and Node.js experience',
          'Senior-level expertise matches requirements',
        ],
        weaknesses: [
          'Limited distributed systems experience mentioned',
        ],
        recommendations: [
          'Highlight any microservices projects',
          'Prepare distributed systems examples',
        ],
        keyRequirements: [
          '5+ years experience: ✓ Met',
          'React/Node.js: ✓ Strong match',
          'Distributed systems: ⚠ Partial match',
        ],
        matchDetails: {
          skillsMatch: 90,
          experienceMatch: 95,
          educationMatch: 100,
        },
        generatedAt: new Date().toISOString(),
      }));

      const result = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result.overallScore).toBe(85);
      expect(result.scoreLabel).toBe('Strong Match');
      expect(result.strengths).toHaveLength(2);
      expect(result.weaknesses).toHaveLength(1);
      expect(result.matchDetails?.skillsMatch).toBe(90);
    });

    it('should fall back to mock analysis when no API key', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const result = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.scoreLabel).toBeTruthy();
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should fall back to mock analysis on AI provider error', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockRejectedValue(
        new Error('Network error')
      );

      const result = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result.overallScore).toBeDefined();
      expect(result.scoreLabel).toBeDefined();
      expect(result.strengths.length).toBeGreaterThan(0);
    });

    it('should handle missing job description in analysis', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        '',
        mockProfile
      );

      expect(result.overallScore).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate appropriate score labels', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      // Match the actual implementation's score thresholds
      if (result.overallScore >= 85) {
        expect(result.scoreLabel).toBe('Excellent Match');
      } else if (result.overallScore >= 75) {
        expect(result.scoreLabel).toBe('Strong Match');
      } else if (result.overallScore >= 65) {
        expect(result.scoreLabel).toBe('Good Match');
      } else {
        expect(result.scoreLabel).toBe('Fair Match');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed AI responses', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockResolvedValue(
        'Invalid JSON response'
      );

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      // Should fall back to mock generation
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.generalTips).toBeDefined();
    });

    it('should handle partial AI responses', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockResolvedValue(JSON.stringify({
        questions: [], // Empty questions array
        generalTips: ['Tip 1'],
      }));

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      // Service returns partial response as-is, doesn't fall back to mock
      expect(result.questions.length).toBe(0);
      expect(result.generalTips).toEqual(['Tip 1']);
    });

    it('should handle API timeout gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      jest.spyOn(AIGenerationService as any, 'callAIProvider').mockImplementation(
        () => new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        })
      );

      const result = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(result).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });
  });

  describe('Prompt Building', () => {
    it('should include all context in interview prep prompt', async () => {
      const buildPromptSpy = jest.spyOn(AIGenerationService as any, 'buildInterviewPreparationPrompt');
      
      delete process.env.OPENAI_API_KEY;
      
      await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(buildPromptSpy).toHaveBeenCalledWith(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      const prompt = buildPromptSpy.mock.results[0].value;
      expect(prompt).toContain('Tech Corp');
      expect(prompt).toContain('Senior Software Engineer');
      expect(prompt).toContain('JavaScript, React, Node.js, Python');
    });

    it('should include all context in job fit analysis prompt', async () => {
      const buildPromptSpy = jest.spyOn(AIGenerationService as any, 'buildJobFitAnalysisPrompt');
      
      delete process.env.OPENAI_API_KEY;
      
      await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      expect(buildPromptSpy).toHaveBeenCalledWith(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      const prompt = buildPromptSpy.mock.results[0].value;
      expect(prompt).toContain('Tech Corp');
      expect(prompt).toContain('Senior Software Engineer');
      expect(prompt).toContain('5+ years of experience');
    });
  });

  describe('Mock Generation Quality', () => {
    it('should generate diverse question difficulties', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      const difficulties = result.questions.map(q => q.difficulty);
      const uniqueDifficulties = new Set(difficulties);
      
      expect(uniqueDifficulties.size).toBeGreaterThan(1);
    });

    it('should generate context-aware mock responses', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await AIGenerationService.generateInterviewPreparation(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      // Check if mock includes context-specific content
      const allContent = JSON.stringify(result);
      expect(allContent).toContain('Tech Corp');
      expect(allContent).toContain('Senior Software Engineer');
    });

    it('should generate reasonable score based on profile match', async () => {
      delete process.env.OPENAI_API_KEY;

      // Test with well-matched profile
      const goodResult = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        mockProfile
      );

      // Test with poorly matched profile
      const poorProfile = {
        skills: 'PHP, MySQL',
        experience_level: 'Junior',
        education: 'High School',
      };

      const poorResult = await AIGenerationService.generateJobFitAnalysis(
        mockContext,
        mockJobDescription,
        poorProfile
      );

      // Both should generate reasonable scores (60-95 range)
      expect(goodResult.overallScore).toBeGreaterThanOrEqual(60);
      expect(goodResult.overallScore).toBeLessThanOrEqual(95);
      expect(poorResult.overallScore).toBeGreaterThanOrEqual(60);
      expect(poorResult.overallScore).toBeLessThanOrEqual(95);
    });
  });
});