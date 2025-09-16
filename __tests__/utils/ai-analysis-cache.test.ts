/**
 * Tests for AI analysis cache functionality
 * Tests caching behavior, memory management, and edge cases
 */

import {
  analysisCache,
  persistentCache,
  aiAnalysisCache,
  createCacheKey,
} from '@/lib/utils/ai-analysis-cache'
import { JobFitAnalysisResult } from '@/types/ai-analysis'

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock analysis result for testing
const createMockAnalysisResult = (overallScore: number = 85): JobFitAnalysisResult => ({
  overallScore,
  scoreLabel: 'Excellent Match',
  strengths: ['Strong technical skills', 'Good culture fit'],
  weaknesses: ['Limited domain experience'],
  recommendations: ['Prepare specific examples', 'Research company culture'],
  keyRequirements: [
    { requirement: 'JavaScript', status: 'met', evidence: 'Strong JS experience' },
    { requirement: 'React', status: 'met', evidence: '3+ years with React' },
    { requirement: 'Node.js', status: 'partial', evidence: 'Some backend experience' }
  ],
  matchDetails: {
    skillsMatch: 90,
    experienceMatch: 80,
    educationMatch: 85,
  },
  generatedAt: new Date().toISOString(),
})

describe('AI Analysis Cache Tests', () => {
  const testUserId = 'test-user-123'
  const testApplicationId = 'app-456'
  const testAnalysisType = 'job-fit-analysis'
  const testKey = createCacheKey(testApplicationId, testAnalysisType as any, testUserId)
  const mockResult = createMockAnalysisResult()

  beforeEach(() => {
    // Clear all caches before each test
    analysisCache.clear()
    persistentCache.clear()
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any intervals
    analysisCache.destroy()
  })

  describe('createCacheKey', () => {
    it('should create consistent cache keys', () => {
      const key1 = createCacheKey('app1', 'job-fit-analysis' as any, 'user1')
      const key2 = createCacheKey('app1', 'job-fit-analysis' as any, 'user1')
      
      expect(key1).toBe(key2)
      expect(key1).toBe('user1:app1:job-fit-analysis')
    })

    it('should create different keys for different parameters', () => {
      const key1 = createCacheKey('app1', 'job-fit-analysis' as any, 'user1')
      const key2 = createCacheKey('app2', 'job-fit-analysis' as any, 'user1')
      const key3 = createCacheKey('app1', 'interview-preparation' as any, 'user1')
      const key4 = createCacheKey('app1', 'job-fit-analysis' as any, 'user2')
      
      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
      expect(key1).not.toBe(key4)
    })

    it('should handle special characters in parameters', () => {
      const key = createCacheKey('app-123_test', 'job-fit-analysis' as any, 'user@example.com')
      expect(key).toBe('user@example.com:app-123_test:job-fit-analysis')
    })
  })

  describe('AnalysisCacheManager (Memory Cache)', () => {
    it('should store and retrieve analysis results', () => {
      analysisCache.set(testKey, mockResult)
      
      const retrieved = analysisCache.get(testKey)
      expect(retrieved).toEqual(mockResult)
    })

    it('should return null for non-existent keys', () => {
      const result = analysisCache.get('non-existent-key')
      expect(result).toBeNull()
    })

    it('should check if key exists', () => {
      expect(analysisCache.has(testKey)).toBe(false)
      
      analysisCache.set(testKey, mockResult)
      expect(analysisCache.has(testKey)).toBe(true)
    })

    it('should delete specific entries', () => {
      analysisCache.set(testKey, mockResult)
      expect(analysisCache.has(testKey)).toBe(true)
      
      const deleted = analysisCache.delete(testKey)
      expect(deleted).toBe(true)
      expect(analysisCache.has(testKey)).toBe(false)
    })

    it('should clear all entries', () => {
      analysisCache.set('key1', mockResult)
      analysisCache.set('key2', mockResult)
      
      analysisCache.clear()
      
      expect(analysisCache.has('key1')).toBe(false)
      expect(analysisCache.has('key2')).toBe(false)
    })

    it('should handle expired entries', () => {
      const originalNow = Date.now
      let mockTime = Date.now()
      Date.now = jest.fn(() => mockTime)
      
      try {
        analysisCache.set(testKey, mockResult)
        expect(analysisCache.has(testKey)).toBe(true)
        
        // Advance time past expiration (assuming 1 hour expiration)
        mockTime += 61 * 60 * 1000 // 61 minutes
        
        expect(analysisCache.has(testKey)).toBe(false)
        expect(analysisCache.get(testKey)).toBeNull()
      } finally {
        Date.now = originalNow
      }
    })

    it('should enforce cache size limits', () => {
      // Fill cache beyond max size
      for (let i = 0; i < 150; i++) { // Assuming max is 100
        analysisCache.set(`key-${i}`, mockResult)
      }
      
      const stats = analysisCache.getStats()
      expect(stats.size).toBeLessThanOrEqual(100) // Should enforce max size
    })

    it('should provide accurate cache statistics', () => {
      analysisCache.set('key1', mockResult)
      analysisCache.set('key2', mockResult)
      
      const stats = analysisCache.getStats()
      expect(stats.size).toBe(2)
      expect(stats.entries).toHaveLength(2)
      expect(stats.entries[0]).toHaveProperty('key')
      expect(stats.entries[0]).toHaveProperty('timestamp')
      expect(stats.entries[0]).toHaveProperty('expiresAt')
      expect(stats.entries[0]).toHaveProperty('expired')
    })

    it('should handle cleanup on retrieval', () => {
      const originalNow = Date.now
      let mockTime = Date.now()
      Date.now = jest.fn(() => mockTime)
      
      try {
        // Add multiple entries
        analysisCache.set('key1', mockResult)
        analysisCache.set('key2', mockResult)
        
        // Expire first entry
        mockTime += 61 * 60 * 1000
        analysisCache.set('key3', mockResult) // This should trigger cleanup
        
        expect(analysisCache.has('key1')).toBe(false) // Expired
        expect(analysisCache.has('key2')).toBe(false) // Expired
        expect(analysisCache.has('key3')).toBe(true)  // Fresh
      } finally {
        Date.now = originalNow
      }
    })
  })

  describe('PersistentCacheManager (localStorage)', () => {
    it('should store and retrieve from localStorage', () => {
      persistentCache.set(testKey, mockResult)
      
      const retrieved = persistentCache.get(testKey)
      expect(retrieved).toEqual(mockResult)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full')
      })
      
      // Mock console.warn to suppress warning in tests
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      // Should not throw error, but will log warning
      expect(() => persistentCache.set(testKey, mockResult)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('Failed to store analysis result in localStorage:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should handle corrupted localStorage data', () => {
      // Mock corrupted data
      localStorageMock.getItem.mockImplementationOnce(() => 'invalid-json')
      
      // Mock console.warn to suppress warning in tests
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const result = persistentCache.get(testKey)
      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalled() // Should clear corrupted data
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse localStorage cache, clearing:', expect.any(SyntaxError))
      
      consoleSpy.mockRestore()
    })

    it('should clean expired entries from localStorage', () => {
      const originalNow = Date.now
      let mockTime = Date.now()
      Date.now = jest.fn(() => mockTime)
      
      try {
        persistentCache.set('key1', mockResult)
        persistentCache.set('key2', mockResult)
        
        // Advance time to expire entries
        mockTime += 61 * 60 * 1000
        
        // Add new entry, which should trigger cleanup
        persistentCache.set('key3', mockResult)
        
        expect(persistentCache.has('key1')).toBe(false)
        expect(persistentCache.has('key2')).toBe(false)
        expect(persistentCache.has('key3')).toBe(true)
      } finally {
        Date.now = originalNow
      }
    })

    it('should enforce size limits in localStorage', () => {
      // Fill cache beyond max size
      for (let i = 0; i < 150; i++) {
        persistentCache.set(`key-${i}`, mockResult)
      }
      
      // Should have removed oldest entries
      expect(persistentCache.has('key-0')).toBe(false)
      expect(persistentCache.has('key-149')).toBe(true)
    })
  })

  describe('HybridCache', () => {
    it('should store in both memory and persistent cache', () => {
      aiAnalysisCache.set(testKey, mockResult)
      
      expect(analysisCache.has(testKey)).toBe(true)
      expect(persistentCache.has(testKey)).toBe(true)
    })

    it('should prefer memory cache for retrieval', () => {
      // Set in persistent cache only
      persistentCache.set(testKey, mockResult)
      
      const result = aiAnalysisCache.get(testKey)
      expect(result).toEqual(mockResult)
      
      // Should now be in memory cache too (warmed up)
      expect(analysisCache.has(testKey)).toBe(true)
    })

    it('should fall back to persistent cache when memory cache misses', () => {
      // Set only in persistent cache
      persistentCache.set(testKey, mockResult)
      
      // Clear memory cache
      analysisCache.clear()
      
      const result = aiAnalysisCache.get(testKey)
      expect(result).toEqual(mockResult)
    })

    it('should return null when both caches miss', () => {
      const result = aiAnalysisCache.get('non-existent-key')
      expect(result).toBeNull()
    })

    it('should delete from both caches', () => {
      aiAnalysisCache.set(testKey, mockResult)
      
      const deleted = aiAnalysisCache.delete(testKey)
      expect(deleted).toBe(true)
      
      expect(analysisCache.has(testKey)).toBe(false)
      expect(persistentCache.has(testKey)).toBe(false)
    })

    it('should clear both caches', () => {
      aiAnalysisCache.set('key1', mockResult)
      aiAnalysisCache.set('key2', mockResult)
      
      aiAnalysisCache.clear()
      
      expect(analysisCache.has('key1')).toBe(false)
      expect(persistentCache.has('key1')).toBe(false)
    })

    it('should check existence in either cache', () => {
      // Set in memory cache only
      analysisCache.set('key1', mockResult)
      
      // Set in persistent cache only
      persistentCache.set('key2', mockResult)
      
      expect(aiAnalysisCache.has('key1')).toBe(true)
      expect(aiAnalysisCache.has('key2')).toBe(true)
      expect(aiAnalysisCache.has('key3')).toBe(false)
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle malicious cache keys', () => {
      const maliciousKey = '<script>alert("xss")</script>'
      
      expect(() => aiAnalysisCache.set(maliciousKey, mockResult)).not.toThrow()
      expect(() => aiAnalysisCache.get(maliciousKey)).not.toThrow()
    })

    it('should handle very long cache keys', () => {
      const longKey = 'a'.repeat(1000)
      
      aiAnalysisCache.set(longKey, mockResult)
      const result = aiAnalysisCache.get(longKey)
      
      expect(result).toEqual(mockResult)
    })

    it('should handle large analysis results', () => {
      const largeResult = {
        ...mockResult,
        recommendations: Array(1000).fill('Large recommendation text that could consume significant memory'),
      }
      
      aiAnalysisCache.set(testKey, largeResult)
      const retrieved = aiAnalysisCache.get(testKey)
      
      expect(retrieved).toEqual(largeResult)
    })

    it('should handle concurrent cache operations', async () => {
      const promises = Array(50).fill(null).map((_, i) => 
        Promise.resolve().then(() => {
          aiAnalysisCache.set(`concurrent-key-${i}`, {
            ...mockResult,
            overallScore: i,
          })
        })
      )
      
      await Promise.all(promises)
      
      // Should have stored most entries without errors (some may be evicted due to cache limits)
      let successCount = 0
      for (let i = 0; i < 50; i++) {
        const result = aiAnalysisCache.get(`concurrent-key-${i}`)
        // Type guard to check if it's a JobFitAnalysisResult
        if (result && 'overallScore' in result && result.overallScore === i) {
          successCount++
        }
      }
      
      // Should have successfully stored most entries (at least 80%)
      expect(successCount).toBeGreaterThan(40)
    })

    it('should handle invalid analysis results gracefully', () => {
      const invalidResult = null as any
      
      expect(() => aiAnalysisCache.set(testKey, invalidResult)).not.toThrow()
      
      const retrieved = aiAnalysisCache.get(testKey)
      expect(retrieved).toBeNull()
    })

    it('should handle cache pollution attempts', () => {
      // Attempt to pollute cache with prototype pollution
      const maliciousResult = {
        ...mockResult,
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
      }
      
      aiAnalysisCache.set(testKey, maliciousResult)
      const retrieved = aiAnalysisCache.get(testKey)
      
      // Should store and retrieve safely without polluting prototypes
      expect(retrieved).toBeDefined()
      expect((Object.prototype as any).polluted).toBeUndefined()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should perform well with many cache operations', () => {
      const startTime = Date.now()
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        aiAnalysisCache.set(`perf-key-${i}`, mockResult)
      }
      
      for (let i = 0; i < 1000; i++) {
        aiAnalysisCache.get(`perf-key-${i}`)
      }
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000) // 1 second
    })

    it('should clean up properly on destroy', () => {
      aiAnalysisCache.set('key1', mockResult)
      aiAnalysisCache.set('key2', mockResult)
      
      analysisCache.destroy()
      
      // Cache should be cleared
      expect(analysisCache.has('key1')).toBe(false)
      expect(analysisCache.has('key2')).toBe(false)
    })
  })
})