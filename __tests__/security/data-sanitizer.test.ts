/**
 * Security tests for data sanitization utilities
 * Tests XSS prevention, input validation, and edge cases
 */

import {
  sanitizeText,
  sanitizeUrl,
  sanitizeAnalysisContext,
  sanitizeApplicationData,
} from '@/lib/security/data-sanitizer'

describe('Data Sanitizer Security Tests', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World'
      const result = sanitizeText(maliciousInput)
      expect(result).toBe('alert(&quot;xss&quot;)Hello World')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('</script>')
    })

    it('should escape dangerous characters', () => {
      const dangerousInput = '&"\''
      const result = sanitizeText(dangerousInput)
      expect(result).toBe('&amp;&quot;&#x27;')
    })

    it('should handle nested HTML tags', () => {
      const nestedInput = '<div><p><span>content</span></p></div>'
      const result = sanitizeText(nestedInput)
      expect(result).toBe('content')
    })

    it('should handle mixed content with attributes', () => {
      const mixedInput = '<img src="javascript:alert(1)" onerror="alert(2)">Safe content'
      const result = sanitizeText(mixedInput)
      expect(result).toBe('Safe content')
    })

    it('should handle non-string inputs safely', () => {
      expect(sanitizeText(null)).toBe('')
      expect(sanitizeText(undefined)).toBe('')
      expect(sanitizeText(123)).toBe('123')
      expect(sanitizeText({})).toBe('[object Object]')
      expect(sanitizeText([])).toBe('')
    })

    it('should preserve legitimate content', () => {
      const legitimateInput = 'This is a normal string with numbers 123 and symbols @#$%'
      const result = sanitizeText(legitimateInput)
      expect(result).toBe('This is a normal string with numbers 123 and symbols @#$%')
    })

    it('should trim whitespace', () => {
      const paddedInput = '   Hello World   '
      const result = sanitizeText(paddedInput)
      expect(result).toBe('Hello World')
    })

    it('should handle extremely long inputs', () => {
      const longInput = 'A'.repeat(10000) + '<script>alert("xss")</script>'
      const result = sanitizeText(longInput)
      expect(result).toBe('A'.repeat(10000) + 'alert(&quot;xss&quot;)')
      expect(result).not.toContain('<script>')
    })
  })

  describe('sanitizeUrl', () => {
    it('should block javascript: protocol', () => {
      const jsUrl = 'javascript:alert("xss")'
      const result = sanitizeUrl(jsUrl)
      expect(result).toBe('')
    })

    it('should block data: protocol', () => {
      const dataUrl = 'data:text/html,<script>alert("xss")</script>'
      const result = sanitizeUrl(dataUrl)
      expect(result).toBe('')
    })

    it('should block vbscript: protocol', () => {
      const vbUrl = 'vbscript:msgbox("xss")'
      const result = sanitizeUrl(vbUrl)
      expect(result).toBe('')
    })

    it('should block file: protocol', () => {
      const fileUrl = 'file:///etc/passwd'
      const result = sanitizeUrl(fileUrl)
      expect(result).toBe('')
    })

    it('should upgrade http to https', () => {
      const httpUrl = 'http://example.com/path'
      const result = sanitizeUrl(httpUrl)
      expect(result).toBe('https://example.com/path')
    })

    it('should allow valid https URLs', () => {
      const httpsUrl = 'https://example.com/safe-path'
      const result = sanitizeUrl(httpsUrl)
      expect(result).toBe(httpsUrl)
    })

    it('should allow relative URLs', () => {
      const relativeUrl = '/api/safe-endpoint'
      const result = sanitizeUrl(relativeUrl)
      expect(result).toBe(relativeUrl)
    })

    it('should allow mailto URLs', () => {
      const mailtoUrl = 'mailto:test@example.com'
      const result = sanitizeUrl(mailtoUrl)
      expect(result).toBe(mailtoUrl)
    })

    it('should handle case-insensitive protocols', () => {
      const mixedCaseJs = 'JAVASCRIPT:alert("xss")'
      const result = sanitizeUrl(mixedCaseJs)
      expect(result).toBe('')
    })

    it('should handle non-string inputs', () => {
      expect(sanitizeUrl(null)).toBe('')
      expect(sanitizeUrl(undefined)).toBe('')
      expect(sanitizeUrl(123)).toBe('')
      expect(sanitizeUrl({})).toBe('')
    })

    it('should handle URLs with encoded characters', () => {
      const encodedJs = 'java%73cript:alert("xss")'
      // Note: This test shows that our sanitizer might need URL decoding first
      // For now, it should block the obvious patterns
      const result = sanitizeUrl(encodedJs)
      expect(result).toBe('') // Should be blocked as unrecognized protocol
    })
  })

  describe('sanitizeAnalysisContext', () => {
    it('should sanitize all text fields', () => {
      const maliciousContext = {
        company: '<script>alert("company")</script>ACME Corp',
        role: '<img src=x onerror=alert("role")>Engineer',
        userId: '<script>alert("user")</script>user123',
        applicationId: '<script>alert("app")</script>app456',
        jobDescription: 'javascript:alert("job")',
        notes: '<div>Some notes</div>',
        extraField: 'should be ignored'
      }

      const result = sanitizeAnalysisContext(maliciousContext)

      expect(result.company).toBe('alert(&quot;company&quot;)ACME Corp')
      expect(result.role).toBe('Engineer') // HTML tags removed, leaving clean text
      expect(result.userId).toBe('alert(&quot;user&quot;)user123')
      expect(result.applicationId).toBe('alert(&quot;app&quot;)app456')
      expect(result.jobDescription).toBe('') // Blocked dangerous URL
      expect(result.notes).toBe('Some notes')
      expect(result.extraField).toBeUndefined() // Extra fields not passed through
    })

    it('should handle null/undefined context', () => {
      expect(sanitizeAnalysisContext(null)).toEqual({})
      expect(sanitizeAnalysisContext(undefined)).toEqual({})
      expect(sanitizeAnalysisContext('string')).toEqual({})
      expect(sanitizeAnalysisContext(123)).toEqual({})
    })

    it('should handle missing fields gracefully', () => {
      const partialContext = {
        company: 'ACME Corp',
        role: 'Engineer'
        // missing userId, applicationId, etc.
      }

      const result = sanitizeAnalysisContext(partialContext)

      expect(result.company).toBe('ACME Corp')
      expect(result.role).toBe('Engineer')
      expect(result.userId).toBe('')
      expect(result.applicationId).toBe('')
      expect(result.jobDescription).toBeUndefined()
      expect(result.notes).toBeUndefined()
    })

    it('should preserve valid job description URLs', () => {
      const context = {
        company: 'ACME Corp',
        role: 'Engineer',
        userId: 'user123',
        applicationId: 'app456',
        jobDescription: 'https://careers.acme.com/job/123'
      }

      const result = sanitizeAnalysisContext(context)
      expect(result.jobDescription).toBe('https://careers.acme.com/job/123')
    })
  })

  describe('sanitizeApplicationData', () => {
    it('should sanitize all application fields', () => {
      const maliciousApp = {
        id: '<script>alert("id")</script>123',
        company: '<img src=x onerror=alert("comp")>ACME',
        role: '<div>Engineer</div>',
        status: '<script>alert("status")</script>Applied',
        date_applied: '<script>alert("date")</script>2024-01-01',
        role_link: 'javascript:alert("link")',
        notes: '<script>alert("notes")</script>Some notes',
        salary_range: '<div>$100k</div>',
        location: '<script>alert("loc")</script>NYC',
        extraField: 'should be ignored'
      }

      const result = sanitizeApplicationData(maliciousApp)

      expect(result.id).toBe('alert(&quot;id&quot;)123')
      expect(result.company).toBe('ACME') // HTML tags removed, leaving clean text
      expect(result.role).toBe('Engineer')
      expect(result.status).toBe('alert(&quot;status&quot;)Applied')
      expect(result.date_applied).toBe('alert(&quot;date&quot;)2024-01-01')
      expect(result.role_link).toBe('') // Blocked dangerous URL
      expect(result.notes).toBe('alert(&quot;notes&quot;)Some notes')
      expect(result.salary_range).toBe('$100k')
      expect(result.location).toBe('alert(&quot;loc&quot;)NYC')
      expect(result.extraField).toBeUndefined() // Extra fields not passed through
    })

    it('should handle null/undefined application data', () => {
      expect(sanitizeApplicationData(null)).toEqual({})
      expect(sanitizeApplicationData(undefined)).toEqual({})
      expect(sanitizeApplicationData('string')).toEqual({})
    })
  })

  describe('Edge Cases and Performance', () => {
    it('should handle extremely large inputs without crashing', () => {
      const largeInput = '<script>' + 'A'.repeat(100000) + '</script>'
      const result = sanitizeText(largeInput)
      expect(result).toBe('A'.repeat(100000))
      expect(result).not.toContain('<script>')
    })

    it('should handle special Unicode characters', () => {
      const unicodeInput = '🚀 Hello 世界 <script>alert("unicode")</script>'
      const result = sanitizeText(unicodeInput)
      expect(result).toBe('🚀 Hello 世界 alert(&quot;unicode&quot;)')
    })

    it('should handle malformed HTML gracefully', () => {
      const malformedInput = '<script><div><span>content</div></script>'
      const result = sanitizeText(malformedInput)
      expect(result).toBe('content')
    })

    it('should be consistent across multiple calls', () => {
      const input = '<script>alert("test")</script>Hello'
      const result1 = sanitizeText(input)
      const result2 = sanitizeText(input)
      expect(result1).toBe(result2)
    })
  })
})