/**
 * Unit tests for Interview Prep API helper functions
 * Tests type safety, validation, error handling, and edge cases
 */

import type { InterviewPreparationResult } from '@/types/ai-analysis'

// Since these are internal functions, we need to test them indirectly
// or extract them to a separate module. For now, let's create a test module
// that exports the functions for testing.

// Mock the functions from the route file
const extractCompanyName = (jobDescription: string): string => {
  try {
    if (!jobDescription || typeof jobDescription !== 'string') {
      return 'the company'
    }

    const limitedDescription = jobDescription.slice(0, 5000)

    const patterns = [
      /(?:at|with|for)\s+([A-Z][a-zA-Z\s&,.-]+?)(?:\s+is|,|\s+we|\s+located|\s+offers|\.)/i,
      /([A-Z][a-zA-Z\s&,.-]+?)\s+is\s+(?:seeking|looking|hiring)/i,
      /join\s+(?:our\s+team\s+at\s+)?([A-Z][a-zA-Z\s&,.-]+?)(?:\s+as|,|\.)/i
    ]

    for (const pattern of patterns) {
      const match = limitedDescription.match(pattern)
      if (match && match[1]) {
        const company = match[1].trim()
        if (company.length > 1 && company.length < 100 && !company.match(/^\d+$/)) {
          return company
        }
      }
    }

    return 'the company'
  } catch (error) {
    console.error('Error extracting company name:', error)
    return 'the company'
  }
}

const extractRoleName = (jobDescription: string): string => {
  try {
    if (!jobDescription || typeof jobDescription !== 'string') {
      return 'this position'
    }

    const limitedDescription = jobDescription.slice(0, 5000)

    const patterns = [
      /(?:position|role|job)\s+(?:title|of|as)?\s*:?\s*([A-Z][a-zA-Z\s-]+?)(?:\s+at|\s+with|\s+for|,|\n|\.)/i,
      /(?:seeking|hiring|looking for)\s+an?\s+([A-Z][a-zA-Z\s-]+?)(?:\s+to|\s+who|\s+at|,|\n|\.)/i,
      /^([A-Z][a-zA-Z\s-]+?)(?:\s+at|\s+with|\s+for|\s+-|,|\n)/i
    ]

    for (const pattern of patterns) {
      const match = limitedDescription.match(pattern)
      if (match && match[1]) {
        const role = match[1].trim()
        if (role.length > 2 && role.length < 100 && !role.match(/^\d+$/)) {
          return role
        }
      }
    }

    return 'this position'
  } catch (error) {
    console.error('Error extracting role name:', error)
    return 'this position'
  }
}

const validateInterviewPreparationResult = (result: InterviewPreparationResult): boolean => {
  try {
    if (!result || typeof result !== 'object') {
      return false
    }

    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      return false
    }

    for (const question of result.questions) {
      if (!question.id || !question.question || !question.category || !question.difficulty) {
        return false
      }
      
      const validCategories = ['behavioral', 'technical', 'company-specific', 'role-specific']
      if (!validCategories.includes(question.category)) {
        return false
      }
      
      const validDifficulties = ['easy', 'medium', 'hard']
      if (!validDifficulties.includes(question.difficulty)) {
        return false
      }
    }

    const requiredArrays = ['generalTips', 'companyInsights', 'roleSpecificAdvice', 'practiceAreas']
    for (const field of requiredArrays) {
      if (!Array.isArray(result[field as keyof InterviewPreparationResult])) {
        return false
      }
    }

    if (typeof result.estimatedDuration !== 'number' || result.estimatedDuration < 0) {
      return false
    }

    if (!result.generatedAt || typeof result.generatedAt !== 'string') {
      return false
    }
    
    const date = new Date(result.generatedAt)
    if (isNaN(date.getTime())) {
      return false
    }

    return true
  } catch (error) {
    console.error('Error validating interview preparation result:', error)
    return false
  }
}

describe('Interview Prep Helper Functions', () => {
  describe('extractCompanyName', () => {
    test('should extract company name from job description with "at" pattern', () => {
      const jobDescription = 'Software Engineer position at Google. We are looking for...'
      const result = extractCompanyName(jobDescription)
      expect(result).toBe('Google')
    })

    test('should extract company name from job description with "is seeking" pattern', () => {
      const jobDescription = 'Microsoft is seeking a talented Software Engineer...'
      const result = extractCompanyName(jobDescription)
      expect(result).toBe('Microsoft')
    })

    test('should extract company name from job description with "join our team" pattern', () => {
      const jobDescription = 'Join our team at Amazon, we are looking for...'
      const result = extractCompanyName(jobDescription)
      expect(result).toBe('Amazon')
    })

    test('should handle company names with special characters', () => {
      const jobDescription = 'We are hiring at AT&T Inc. We are a company located in Dallas...'
      const result = extractCompanyName(jobDescription)
      expect(result).toBe('AT&T Inc')
    })

    test('should return default for empty job description', () => {
      const result = extractCompanyName('')
      expect(result).toBe('the company')
    })

    test('should return default for null input', () => {
      const result = extractCompanyName(null as any)
      expect(result).toBe('the company')
    })

    test('should return default for undefined input', () => {
      const result = extractCompanyName(undefined as any)
      expect(result).toBe('the company')
    })

    test('should return default for non-string input', () => {
      const result = extractCompanyName(123 as any)
      expect(result).toBe('the company')
    })

    test('should handle very long job descriptions (security test)', () => {
      const longDescription = 'A'.repeat(10000) + ' at Test Company. We are...'
      const result = extractCompanyName(longDescription)
      expect(result).toBe('the company') // Should not find company due to truncation
    })

    test('should reject purely numeric company names', () => {
      const jobDescription = 'Position at 123. We are looking for...'
      const result = extractCompanyName(jobDescription)
      expect(result).toBe('the company')
    })

    test('should reject extremely long company names', () => {
      const longCompany = 'A'.repeat(150)
      const jobDescription = `Position at ${longCompany}. We are looking for...`
      const result = extractCompanyName(jobDescription)
      expect(result).toBe('the company')
    })
  })

  describe('extractRoleName', () => {
    test('should extract role from "position" pattern', () => {
      const jobDescription = 'Position title: Senior Software Engineer at Google...'
      const result = extractRoleName(jobDescription)
      expect(result).toBe('Senior Software Engineer')
    })

    test('should extract role from "seeking" pattern', () => {
      const jobDescription = 'We are seeking a Data Scientist to join our team...'
      const result = extractRoleName(jobDescription)
      expect(result).toBe('Data Scientist')
    })

    test('should extract role from beginning of description', () => {
      const jobDescription = 'Product Manager - San Francisco\\nWe are looking for...'
      const result = extractRoleName(jobDescription)
      expect(result).toBe('Product Manager')
    })

    test('should handle roles with hyphens', () => {
      const jobDescription = 'Seeking a Full-Stack Developer to work with...'
      const result = extractRoleName(jobDescription)
      expect(result).toBe('Full-Stack Developer')
    })

    test('should return default for empty job description', () => {
      const result = extractRoleName('')
      expect(result).toBe('this position')
    })

    test('should return default for null input', () => {
      const result = extractRoleName(null as any)
      expect(result).toBe('this position')
    })

    test('should return default for undefined input', () => {
      const result = extractRoleName(undefined as any)
      expect(result).toBe('this position')
    })

    test('should return default for non-string input', () => {
      const result = extractRoleName(123 as any)
      expect(result).toBe('this position')
    })

    test('should handle very long job descriptions (security test)', () => {
      const longDescription = 'A'.repeat(10000) + ' Senior Engineer at...'
      const result = extractRoleName(longDescription)
      expect(result).toBe('this position') // Should not find role due to truncation
    })

    test('should reject purely numeric role names', () => {
      const jobDescription = 'Position: 123 at Google...'
      const result = extractRoleName(jobDescription)
      expect(result).toBe('this position')
    })

    test('should reject extremely short role names', () => {
      const jobDescription = 'Position: X at Google...'
      const result = extractRoleName(jobDescription)
      expect(result).toBe('this position')
    })

    test('should reject extremely long role names', () => {
      const longRole = 'A'.repeat(150)
      const jobDescription = `Position: ${longRole} at Google...`
      const result = extractRoleName(jobDescription)
      expect(result).toBe('this position')
    })
  })

  describe('validateInterviewPreparationResult', () => {
    const validResult: InterviewPreparationResult = {
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
      roleSpecificAdvice: ['Understand the role requirements'],
      practiceAreas: ['Behavioral questions'],
      estimatedDuration: 30,
      generatedAt: new Date().toISOString()
    }

    test('should validate a complete and correct result', () => {
      const result = validateInterviewPreparationResult(validResult)
      expect(result).toBe(true)
    })

    test('should reject null result', () => {
      const result = validateInterviewPreparationResult(null as any)
      expect(result).toBe(false)
    })

    test('should reject undefined result', () => {
      const result = validateInterviewPreparationResult(undefined as any)
      expect(result).toBe(false)
    })

    test('should reject non-object result', () => {
      const result = validateInterviewPreparationResult('string' as any)
      expect(result).toBe(false)
    })

    test('should reject result with empty questions array', () => {
      const invalidResult = { ...validResult, questions: [] }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with invalid question category', () => {
      const invalidResult = {
        ...validResult,
        questions: [
          { ...validResult.questions[0], category: 'invalid' as any }
        ]
      }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with invalid question difficulty', () => {
      const invalidResult = {
        ...validResult,
        questions: [
          { ...validResult.questions[0], difficulty: 'invalid' as any }
        ]
      }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with missing question fields', () => {
      const invalidResult = {
        ...validResult,
        questions: [
          { id: 'q1', category: 'behavioral' } as any
        ]
      }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with non-array generalTips', () => {
      const invalidResult = { ...validResult, generalTips: 'string' as any }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with negative estimated duration', () => {
      const invalidResult = { ...validResult, estimatedDuration: -5 }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with invalid generatedAt date', () => {
      const invalidResult = { ...validResult, generatedAt: 'invalid-date' }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should reject result with missing generatedAt', () => {
      const invalidResult = { ...validResult, generatedAt: '' }
      const result = validateInterviewPreparationResult(invalidResult)
      expect(result).toBe(false)
    })

    test('should handle validation errors gracefully', () => {
      // Create a result that will cause an error during validation
      const problematicResult = {
        ...validResult,
        questions: [
          new Proxy({}, {
            get() {
              throw new Error('Test error')
            }
          })
        ]
      } as any

      const result = validateInterviewPreparationResult(problematicResult)
      expect(result).toBe(false)
    })
  })
})