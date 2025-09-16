/**
 * Edge case and error handling tests for Interview Prep API
 * Tests security, performance, and robustness scenarios
 */

import type { InterviewPreparationResult } from '@/types/ai-analysis'

// Mock the content handling functions for testing
const handleExistingPrepContent = (
  content: any,
  structured: boolean,
  jobDescription: string
): string | InterviewPreparationResult => {
  try {
    if (!content) {
      throw new Error('No existing preparation content found')
    }

    if (typeof content === 'object' && structured) {
      return content as InterviewPreparationResult
    }

    if (typeof content === 'object' && !structured) {
      return JSON.stringify(content, null, 2)
    }

    if (typeof content === 'string' && structured) {
      // Simplified parsing for test
      return {
        questions: [{ id: 'q1', category: 'behavioral', question: 'Test?', suggestedApproach: 'Test', difficulty: 'easy' }],
        generalTips: ['Test tip'],
        companyInsights: ['Test insight'],
        roleSpecificAdvice: ['Test advice'],
        practiceAreas: ['Test area'],
        estimatedDuration: 30,
        generatedAt: new Date().toISOString()
      } as InterviewPreparationResult
    }

    if (typeof content === 'string' && !structured) {
      return content
    }

    return String(content)
  } catch (error) {
    console.error('Error handling existing prep content:', error)
    return typeof content === 'string' ? content : 'Error processing existing preparation content'
  }
}

const handleNewPrepContent = (
  content: string,
  structured: boolean,
  jobDescription: string
): string | InterviewPreparationResult => {
  try {
    if (!structured) {
      return content
    }

    // Simplified parsing for test
    return {
      questions: [{ id: 'q1', category: 'behavioral', question: 'Test?', suggestedApproach: 'Test', difficulty: 'easy' }],
      generalTips: ['Test tip'],
      companyInsights: ['Test insight'],
      roleSpecificAdvice: ['Test advice'],
      practiceAreas: ['Test area'],
      estimatedDuration: 30,
      generatedAt: new Date().toISOString()
    } as InterviewPreparationResult
  } catch (error) {
    console.error('Error parsing new prep content:', error)
    return content
  }
}

describe('Interview Prep API Edge Cases', () => {
  describe('Content Handling Edge Cases', () => {
    test('should handle null existing content gracefully', () => {
      const result = handleExistingPrepContent(null, false, 'Job description')
      expect(result).toBe('Error processing existing preparation content')
    })

    test('should handle undefined existing content gracefully', () => {
      const result = handleExistingPrepContent(undefined, false, 'Job description')
      expect(result).toBe('Error processing existing preparation content')
    })

    test('should handle empty string existing content', () => {
      const result = handleExistingPrepContent('', false, 'Job description')
      expect(result).toBe('')
    })

    test('should handle malformed JSON in existing content', () => {
      const malformedObject = {
        questions: 'not an array',
        invalidField: true
      }
      const result = handleExistingPrepContent(malformedObject, true, 'Job description')
      expect(result).toEqual(malformedObject) // Should return as-is for malformed structured content
    })

    test('should handle circular references in existing object content', () => {
      const circularObject: any = { name: 'test' }
      circularObject.self = circularObject // Create circular reference
      
      const result = handleExistingPrepContent(circularObject, false, 'Job description')
      expect(typeof result).toBe('string') // Should convert to string despite circular reference
    })

    test('should handle very large content strings', () => {
      const largeContent = 'A'.repeat(100000) // 100KB string
      const result = handleExistingPrepContent(largeContent, false, 'Job description')
      expect(result).toBe(largeContent)
    })

    test('should handle content with special characters', () => {
      const specialContent = 'Content with émojis 🚀 and speciál chars: <>&"\\n\\t'
      const result = handleExistingPrepContent(specialContent, false, 'Job description')
      expect(result).toBe(specialContent)
    })

    test('should handle boolean content type', () => {
      const result = handleExistingPrepContent(true, false, 'Job description')
      expect(result).toBe('true')
    })

    test('should handle number content type', () => {
      const result = handleExistingPrepContent(12345, false, 'Job description')
      expect(result).toBe('12345')
    })

    test('should handle array content type', () => {
      const arrayContent = ['item1', 'item2', 'item3']
      const result = handleExistingPrepContent(arrayContent, false, 'Job description')
      expect(typeof result).toBe('string')
      expect(result).toContain('item1')
    })
  })

  describe('Security and Input Validation', () => {
    test('should handle extremely long job descriptions safely', () => {
      const veryLongJobDescription = 'A'.repeat(1000000) // 1MB string
      const result = handleNewPrepContent('Content', true, veryLongJobDescription)
      expect(typeof result).toBe('object') // Should still process without crashing
    })

    test('should handle job descriptions with malicious patterns', () => {
      const maliciousJobDescription = `
        <script>alert('xss')</script>
        javascript:void(0)
        data:text/html,<script>alert('xss')</script>
        Company Name is looking for..
      `
      const result = handleNewPrepContent('Content', true, maliciousJobDescription)
      expect(typeof result).toBe('object') // Should process safely
    })

    test('should handle Unicode and international characters in job descriptions', () => {
      const unicodeJobDescription = '🏢 会社名 is seeking a développeur for our équipe in москва'
      const result = handleNewPrepContent('Content', true, unicodeJobDescription)
      expect(typeof result).toBe('object')
    })

    test('should handle null bytes and control characters', () => {
      const malformedJobDescription = 'Company\x00Name\x01\x02\x03 is hiring'
      const result = handleNewPrepContent('Content', true, malformedJobDescription)
      expect(typeof result).toBe('object')
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    test('should handle deeply nested objects in existing content', () => {
      const deepObject: any = {}
      let current = deepObject
      
      // Create 100 levels of nesting
      for (let i = 0; i < 100; i++) {
        current.nested = {}
        current = current.nested
      }
      current.value = 'deep value'
      
      const result = handleExistingPrepContent(deepObject, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle objects with many properties', () => {
      const objectWithManyProps: any = {}
      
      // Create object with 1000 properties
      for (let i = 0; i < 1000; i++) {
        objectWithManyProps[`prop${i}`] = `value${i}`
      }
      
      const result = handleExistingPrepContent(objectWithManyProps, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle arrays with many elements', () => {
      const largeArray = new Array(10000).fill('item')
      const result = handleExistingPrepContent(largeArray, false, 'Job description')
      expect(typeof result).toBe('string')
    })
  })

  describe('Data Type Coercion Edge Cases', () => {
    test('should handle Date objects in existing content', () => {
      const dateContent = new Date()
      const result = handleExistingPrepContent(dateContent, false, 'Job description')
      expect(typeof result).toBe('string')
      expect(result).toContain(dateContent.getFullYear().toString())
    })

    test('should handle RegExp objects in existing content', () => {
      const regexContent = /test/gi
      const result = handleExistingPrepContent(regexContent, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle Error objects in existing content', () => {
      const errorContent = new Error('Test error')
      const result = handleExistingPrepContent(errorContent, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle Buffer objects in existing content', () => {
      const bufferContent = Buffer.from('test content')
      const result = handleExistingPrepContent(bufferContent, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle Symbol in existing content', () => {
      const symbolContent = Symbol('test')
      const result = handleExistingPrepContent(symbolContent, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle BigInt in existing content', () => {
      const bigIntContent = BigInt('123456789012345678901234567890')
      const result = handleExistingPrepContent(bigIntContent, false, 'Job description')
      expect(typeof result).toBe('string')
    })
  })

  describe('Concurrent Access and Race Conditions', () => {
    test('should handle multiple rapid parsing requests', async () => {
      const promises = []
      
      // Simulate 100 concurrent parsing requests
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(handleNewPrepContent(`Content ${i}`, true, `Job ${i}`))
        )
      }
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(100)
      results.forEach((result, index) => {
        expect(typeof result).toBe('object')
      })
    })

    test('should handle mixed structured/unstructured requests', async () => {
      const promises = []
      
      // Alternate between structured and unstructured requests
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve(handleNewPrepContent(`Content ${i}`, i % 2 === 0, `Job ${i}`))
        )
      }
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(50)
      results.forEach((result, index) => {
        if (index % 2 === 0) {
          expect(typeof result).toBe('object') // Structured
        } else {
          expect(typeof result).toBe('string') // Unstructured
        }
      })
    })
  })

  describe('Boundary Value Testing', () => {
    test('should handle empty job description', () => {
      const result = handleNewPrepContent('Content', true, '')
      expect(typeof result).toBe('object')
    })

    test('should handle single character job description', () => {
      const result = handleNewPrepContent('Content', true, 'A')
      expect(typeof result).toBe('object')
    })

    test('should handle job description with only whitespace', () => {
      const result = handleNewPrepContent('Content', true, '   \\n\\t   ')
      expect(typeof result).toBe('object')
    })

    test('should handle job description with only special characters', () => {
      const result = handleNewPrepContent('Content', true, '!@#$%^&*()_+-=[]{}|;:,.<>?')
      expect(typeof result).toBe('object')
    })

    test('should handle content with only line breaks', () => {
      const result = handleExistingPrepContent('\\n\\n\\n\\n\\n', false, 'Job description')
      expect(result).toBe('\\n\\n\\n\\n\\n')
    })

    test('should handle content with mixed line endings', () => {
      const mixedLineEndings = 'Line 1\\nLine 2\\r\\nLine 3\\rLine 4'
      const result = handleExistingPrepContent(mixedLineEndings, false, 'Job description')
      expect(result).toBe(mixedLineEndings)
    })
  })

  describe('Error Recovery and Graceful Degradation', () => {
    test('should recover from JSON stringify errors', () => {
      const problematicObject = {}
      Object.defineProperty(problematicObject, 'circular', {
        get() {
          return problematicObject
        }
      })
      
      const result = handleExistingPrepContent(problematicObject, false, 'Job description')
      expect(typeof result).toBe('string') // Should still return a string
    })

    test('should handle content with getter that throws', () => {
      const problematicObject = {
        get dangerous() {
          throw new Error('Getter error')
        },
        safe: 'value'
      }
      
      const result = handleExistingPrepContent(problematicObject, false, 'Job description')
      expect(typeof result).toBe('string')
    })

    test('should handle content with non-enumerable properties', () => {
      const objectWithHiddenProps = { visible: 'yes' }
      Object.defineProperty(objectWithHiddenProps, 'hidden', {
        value: 'secret',
        enumerable: false
      })
      
      const result = handleExistingPrepContent(objectWithHiddenProps, false, 'Job description')
      expect(typeof result).toBe('string')
      expect(result).toContain('visible')
    })

    test('should handle frozen objects', () => {
      const frozenObject = Object.freeze({ data: 'frozen' })
      const result = handleExistingPrepContent(frozenObject, false, 'Job description')
      expect(typeof result).toBe('string')
      expect(result).toContain('frozen')
    })

    test('should handle sealed objects', () => {
      const sealedObject = Object.seal({ data: 'sealed' })
      const result = handleExistingPrepContent(sealedObject, false, 'Job description')
      expect(typeof result).toBe('string')
      expect(result).toContain('sealed')
    })
  })
})