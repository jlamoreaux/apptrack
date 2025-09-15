/**
 * Comprehensive tests for InterviewPrepTransformerService
 * Tests service layer functionality, caching, configuration, and edge cases
 */

import { InterviewPrepTransformerService } from '@/lib/services/interview-prep-transformer'
import type { InterviewPreparationResult } from '@/types/ai-analysis'

// Mock the response parser
jest.mock('@/lib/ai-coach/response-parser', () => ({
  parseInterviewPreparation: jest.fn()
}))

// Mock the config to control behavior in tests
jest.mock('@/lib/config/interview-prep', () => ({
  getEnvironmentConfig: () => ({
    PARSING: {
      MAX_JOB_DESCRIPTION_LENGTH: 1000,
      MAX_COMPANY_NAME_LENGTH: 50,
      MAX_ROLE_NAME_LENGTH: 50,
      MIN_COMPANY_NAME_LENGTH: 1,
      MIN_ROLE_NAME_LENGTH: 2,
    },
    DEFAULTS: {
      COMPANY_NAME: 'test company',
      ROLE_NAME: 'test position',
      ESTIMATED_DURATION: 30,
      FALLBACK_QUESTION_ID: 'fallback-1',
    },
    CACHE: {
      EXPIRATION_MS: 1000,
      MAX_ENTRIES: 5,
      CLEANUP_INTERVAL_MS: 500,
    },
    VALIDATION: {
      MIN_QUESTIONS: 1,
      MAX_QUESTIONS: 20,
      MIN_TIPS: 0,
      MAX_TIPS: 10,
      MIN_DURATION: 10,
      MAX_DURATION: 180,
      REQUIRED_QUESTION_FIELDS: ['id', 'question', 'category', 'difficulty', 'suggestedApproach'],
      VALID_CATEGORIES: ['behavioral', 'technical', 'company-specific', 'role-specific'],
      VALID_DIFFICULTIES: ['easy', 'medium', 'hard'],
    },
    PATTERNS: {
      COMPANY_EXTRACTION: [
        /(?:at|with|for)\s+([A-Z][a-zA-Z\s&,.-]+?)(?:\s+is|,|\s+we|\s+located|\s+offers|\.)/i,
        /([A-Z][a-zA-Z\s&,.-]+?)\s+is\s+(?:seeking|looking|hiring)/i,
      ],
      ROLE_EXTRACTION: [
        /(?:position|role|job)\s+(?:title|of|as)?\s*:?\s*([A-Z][a-zA-Z\s-]+?)(?:\s+at|\s+with|\s+for|,|\n|\.)/i,
        /(?:seeking|hiring|looking for)\s+an?\s+([A-Z][a-zA-Z\s-]+?)(?:\s+to|\s+who|\s+at|,|\n|\.)/i,
      ],
      INVALID_NAME: /^\d+$/,
    },
    ERROR_MESSAGES: {
      NO_CONTENT: 'No content provided for transformation',
      FALLBACK_CONTENT: 'Content temporarily unavailable',
    },
    PERFORMANCE: {
      SLOW_TRANSFORMATION_MS: 100,
      CACHE_HIT_RATE_WARNING: 0.5,
      MAX_TRANSFORMATION_TIME_MS: 5000,
    },
    FEATURES: {
      ENABLE_CACHING: true,
      ENABLE_PERFORMANCE_MONITORING: true,
      ENABLE_DETAILED_LOGGING: true,
      ENABLE_CONTEXT_ENHANCEMENT: true,
      ENABLE_FALLBACK_VALIDATION: true,
    },
  }),
  InterviewPrepValidation: {
    isValidCategory: (category: string) => ['behavioral', 'technical', 'company-specific', 'role-specific'].includes(category),
    isValidDifficulty: (difficulty: string) => ['easy', 'medium', 'hard'].includes(difficulty),
    isValidCompanyName: (name: string) => name.length >= 1 && name.length < 50 && !/^\d+$/.test(name),
    isValidRoleName: (name: string) => name.length >= 2 && name.length < 50 && !/^\d+$/.test(name),
    isValidDuration: (duration: number) => duration >= 10 && duration <= 180,
  }
}))

const mockParseInterviewPreparation = require('@/lib/ai-coach/response-parser').parseInterviewPreparation

describe('InterviewPrepTransformerService', () => {
  let service: InterviewPrepTransformerService
  
  const mockValidStructuredContent: InterviewPreparationResult = {
    questions: [
      {
        id: 'q1',
        category: 'behavioral',
        question: 'Tell me about yourself.',
        suggestedApproach: 'Be concise and relevant.',
        difficulty: 'easy'
      }
    ],
    generalTips: ['Be confident'],
    companyInsights: ['Research the company'],
    roleSpecificAdvice: ['Understand the role'],
    practiceAreas: ['Common questions'],
    estimatedDuration: 30,
    generatedAt: new Date().toISOString()
  }

  beforeEach(() => {
    service = new InterviewPrepTransformerService()
    jest.clearAllMocks()
    mockParseInterviewPreparation.mockReturnValue(mockValidStructuredContent)
  })

  describe('transform()', () => {
    describe('Basic Functionality', () => {
      test('should transform string to unstructured response', async () => {
        const request = {
          content: 'Test content',
          structured: false,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(result.content).toBe('Test content')
        expect(result.fromCache).toBe(false)
        expect(typeof result.transformationTime).toBe('number')
      })

      test('should transform string to structured response', async () => {
        const request = {
          content: 'Test content',
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(result.content).toEqual(mockValidStructuredContent)
        expect(result.fromCache).toBe(false)
        expect(mockParseInterviewPreparation).toHaveBeenCalledWith(
          'Test content',
          { company: 'Google', role: 'Software Engineer' }
        )
      })

      test('should handle already structured content for structured request', async () => {
        const request = {
          content: mockValidStructuredContent,
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(result.content).toEqual(mockValidStructuredContent)
        expect(result.fromCache).toBe(false)
        expect(mockParseInterviewPreparation).not.toHaveBeenCalled()
      })

      test('should convert structured content to string for unstructured request', async () => {
        const request = {
          content: mockValidStructuredContent,
          structured: false,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(typeof result.content).toBe('string')
        expect(result.content).toContain('questions')
        expect(result.fromCache).toBe(false)
      })
    })

    describe('Caching Functionality', () => {
      test('should cache structured transformation results', async () => {
        const request = {
          content: 'Test content',
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        // First call
        const result1 = await service.transform(request)
        expect(result1.fromCache).toBe(false)

        // Second call should hit cache
        const result2 = await service.transform(request)
        expect(result2.fromCache).toBe(true)
        expect(result2.content).toEqual(result1.content)
      })

      test('should not cache unstructured responses', async () => {
        const request = {
          content: 'Test content',
          structured: false,
          jobDescription: 'Software Engineer at Google'
        }

        // Two calls should both be fresh (not cached)
        const result1 = await service.transform(request)
        const result2 = await service.transform(request)

        expect(result1.fromCache).toBe(false)
        expect(result2.fromCache).toBe(false)
      })

      test('should respect cache expiration', async () => {
        const request = {
          content: 'Test content',
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        // First call
        const result1 = await service.transform(request)
        expect(result1.fromCache).toBe(false)

        // Wait for cache expiration (1000ms in test config)
        await new Promise(resolve => setTimeout(resolve, 1100))

        // Second call should not hit expired cache
        const result2 = await service.transform(request)
        expect(result2.fromCache).toBe(false)
      })

      test('should handle cache size limits', async () => {
        const requests = []
        // Create more requests than cache limit (5 in test config)
        for (let i = 0; i < 7; i++) {
          requests.push({
            content: `Test content ${i}`,
            structured: true,
            jobDescription: `Job ${i} at Company ${i}`
          })
        }

        // Fill cache beyond limit
        for (const request of requests) {
          await service.transform(request)
        }

        const stats = service.getCacheStats()
        expect(stats.size).toBeLessThanOrEqual(5) // Should not exceed max size
      })
    })

    describe('Error Handling', () => {
      test('should handle null content', async () => {
        const request = {
          content: null,
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(typeof result.content).toBe('object') // Should return fallback structured content
        expect(result.fromCache).toBe(false)
      })

      test('should handle undefined content', async () => {
        const request = {
          content: undefined as any,
          structured: false,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(result.content).toBe('Content temporarily unavailable')
        expect(result.fromCache).toBe(false)
      })

      test('should handle parsing errors gracefully', async () => {
        mockParseInterviewPreparation.mockImplementation(() => {
          throw new Error('Parsing failed')
        })

        const request = {
          content: 'Test content',
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        const result = await service.transform(request)

        expect(result.content).toBe('Test content') // Should fallback to original
        expect(result.fromCache).toBe(false)
      })

      test('should handle invalid structured content', async () => {
        const invalidStructuredContent = {
          questions: [], // Empty questions array should be invalid
          generalTips: ['tip'],
          companyInsights: ['insight'],
          roleSpecificAdvice: ['advice'],
          practiceAreas: ['area'],
          estimatedDuration: 30,
          generatedAt: new Date().toISOString()
        }

        const request = {
          content: invalidStructuredContent,
          structured: true,
          jobDescription: 'Software Engineer at Google'
        }

        // Should convert to string and re-parse since validation fails
        const result = await service.transform(request)
        expect(mockParseInterviewPreparation).toHaveBeenCalled()
      })
    })
  })

  describe('extractJobContext()', () => {
    test('should extract company and role from job description', () => {
      const context = service.extractJobContext('Software Engineer position at Google. We are looking for...')
      
      expect(context.company).toBe('Google')
      expect(context.role).toBe('Software Engineer')
    })

    test('should handle empty job description', () => {
      const context = service.extractJobContext('')
      
      expect(context.company).toBe('test company')
      expect(context.role).toBe('test position')
    })

    test('should handle null job description', () => {
      const context = service.extractJobContext(null as any)
      
      expect(context.company).toBe('test company')
      expect(context.role).toBe('test position')
    })

    test('should extract company with special characters', () => {
      const context = service.extractJobContext('Position at AT&T Inc. We are seeking...')
      
      expect(context.company).toBe('AT&T Inc')
    })

    test('should handle job descriptions without clear patterns', () => {
      const context = service.extractJobContext('This is a job posting with no clear company or role.')
      
      expect(context.company).toBe('test company')
      expect(context.role).toBe('test position')
    })

    test('should handle very long job descriptions', () => {
      const longJobDescription = 'A'.repeat(2000) + ' Software Engineer at Google'
      const context = service.extractJobContext(longJobDescription)
      
      // Should still work but with truncated content
      expect(context).toBeDefined()
      expect(typeof context.company).toBe('string')
      expect(typeof context.role).toBe('string')
    })
  })

  describe('getCacheStats()', () => {
    test('should return correct cache statistics', async () => {
      // Add some items to cache
      await service.transform({
        content: 'Test 1',
        structured: true,
        jobDescription: 'Job 1'
      })
      
      await service.transform({
        content: 'Test 2',
        structured: true,
        jobDescription: 'Job 2'
      })

      // Hit cache
      await service.transform({
        content: 'Test 1',
        structured: true,
        jobDescription: 'Job 1'
      })

      const stats = service.getCacheStats()
      
      expect(stats.size).toBe(2)
      expect(stats.hitRate).toBeGreaterThan(0)
      expect(stats.maxSize).toBe(5)
      expect(stats.totalRequests).toBeGreaterThan(0)
      expect(typeof stats.oldestEntry).toBe('number')
    })

    test('should handle empty cache', () => {
      const stats = service.getCacheStats()
      
      expect(stats.size).toBe(0)
      expect(stats.hitRate).toBe(0)
      expect(stats.oldestEntry).toBe(null)
    })
  })

  describe('clearCache()', () => {
    test('should clear all cache entries', async () => {
      // Add item to cache
      await service.transform({
        content: 'Test content',
        structured: true,
        jobDescription: 'Software Engineer at Google'
      })

      expect(service.getCacheStats().size).toBe(1)

      service.clearCache()

      expect(service.getCacheStats().size).toBe(0)
    })
  })

  describe('Validation Integration', () => {
    test('should validate structured content correctly', async () => {
      const validContent: InterviewPreparationResult = {
        questions: [
          {
            id: 'q1',
            category: 'behavioral',
            question: 'Test question?',
            suggestedApproach: 'Test approach',
            difficulty: 'easy'
          }
        ],
        generalTips: ['tip1'],
        companyInsights: ['insight1'],
        roleSpecificAdvice: ['advice1'],
        practiceAreas: ['area1'],
        estimatedDuration: 45,
        generatedAt: new Date().toISOString()
      }

      const request = {
        content: validContent,
        structured: true,
        jobDescription: 'Software Engineer at Google'
      }

      const result = await service.transform(request)
      expect(result.content).toEqual(validContent)
    })

    test('should reject invalid categories', async () => {
      const invalidContent = {
        questions: [
          {
            id: 'q1',
            category: 'invalid-category',
            question: 'Test question?',
            suggestedApproach: 'Test approach',
            difficulty: 'easy'
          }
        ],
        generalTips: ['tip1'],
        companyInsights: ['insight1'],
        roleSpecificAdvice: ['advice1'],
        practiceAreas: ['area1'],
        estimatedDuration: 45,
        generatedAt: new Date().toISOString()
      }

      const request = {
        content: invalidContent,
        structured: true,
        jobDescription: 'Software Engineer at Google'
      }

      const result = await service.transform(request)
      // Should re-parse since validation failed
      expect(mockParseInterviewPreparation).toHaveBeenCalled()
    })
  })

  describe('Performance Monitoring', () => {
    test('should track transformation time', async () => {
      const request = {
        content: 'Test content',
        structured: true,
        jobDescription: 'Software Engineer at Google'
      }

      const result = await service.transform(request)
      
      expect(typeof result.transformationTime).toBe('number')
      expect(result.transformationTime).toBeGreaterThan(0)
    })

    test('should log slow transformations', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      // Mock slow parsing
      mockParseInterviewPreparation.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockValidStructuredContent), 150) // Slower than 100ms threshold
        })
      })

      const request = {
        content: 'Test content',
        structured: true,
        jobDescription: 'Software Engineer at Google'
      }

      await service.transform(request)
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Slow transformation detected'))
      
      consoleSpy.mockRestore()
    })
  })

  describe('Concurrent Operations', () => {
    test('should handle concurrent transformations safely', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        content: `Test content ${i}`,
        structured: true,
        jobDescription: `Job ${i} at Company ${i}`
      }))

      // Execute all transformations concurrently
      const results = await Promise.all(
        requests.map(request => service.transform(request))
      )

      expect(results).toHaveLength(10)
      results.forEach((result, index) => {
        expect(result.content).toBeDefined()
        expect(typeof result.transformationTime).toBe('number')
      })
    })

    test('should maintain cache consistency under concurrent access', async () => {
      const sameRequest = {
        content: 'Shared content',
        structured: true,
        jobDescription: 'Shared job description'
      }

      // Multiple concurrent requests for the same content
      const results = await Promise.all([
        service.transform(sameRequest),
        service.transform(sameRequest),
        service.transform(sameRequest),
        service.transform(sameRequest),
        service.transform(sameRequest)
      ])

      // First should be fresh, rest should be cached or consistent
      expect(results[0].fromCache).toBe(false)
      
      // All should have the same content
      const firstContent = results[0].content
      results.forEach(result => {
        expect(result.content).toEqual(firstContent)
      })
    })
  })
})