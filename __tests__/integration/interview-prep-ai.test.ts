/**
 * Integration tests for Interview Prep AI functionality
 * Tests real AI parsing scenarios and end-to-end workflows
 */

import { InterviewPrepTransformerService } from '@/lib/services/interview-prep-transformer'
import { parseInterviewPreparation } from '@/lib/ai-coach/response-parser'
import type { InterviewPreparationResult } from '@/types/ai-analysis'

// Don't mock the parser for integration tests - use real implementation
describe('Interview Prep AI Integration Tests', () => {
  let service: InterviewPrepTransformerService

  beforeEach(() => {
    service = new InterviewPrepTransformerService()
  })

  describe('Real AI Response Parsing', () => {
    test('should parse structured AI response with JSON format', async () => {
      const aiResponseWithJSON = `
Here's your interview preparation:

{
  "questions": [
    {
      "id": "q1",
      "category": "behavioral",
      "question": "Tell me about yourself.",
      "suggestedApproach": "Provide a concise professional summary.",
      "difficulty": "easy"
    },
    {
      "id": "q2", 
      "category": "technical",
      "question": "How would you optimize database queries?",
      "suggestedApproach": "Discuss indexing, query optimization, and caching strategies.",
      "difficulty": "medium"
    }
  ],
  "generalTips": ["Be confident", "Ask thoughtful questions"],
  "companyInsights": ["Fast-growing startup", "Values innovation"],
  "roleSpecificAdvice": ["Understand microservices architecture"],
  "practiceAreas": ["System design", "Behavioral questions"],
  "estimatedDuration": 45
}

Good luck with your interview!
      `

      const result = await service.transform({
        content: aiResponseWithJSON,
        structured: true,
        jobDescription: 'Senior Software Engineer at TechCorp'
      })

      expect(typeof result.content).toBe('object')
      const parsed = result.content as InterviewPreparationResult
      
      expect(parsed.questions).toHaveLength(2)
      expect(parsed.questions[0].category).toBe('behavioral')
      expect(parsed.questions[1].category).toBe('technical')
      expect(parsed.generalTips).toContain('Be confident')
      expect(parsed.estimatedDuration).toBe(45)
    })

    test('should parse unstructured AI response with text format', async () => {
      const aiResponseText = `
# Interview Preparation for Software Engineer at Google

## Key Questions to Prepare For:

1. Tell me about yourself and your background.
   - Focus on your technical experience and passion for software development
   
2. Why do you want to work at Google?
   - Research Google's mission and connect it to your career goals
   
3. Describe a challenging technical problem you solved.
   - Use the STAR method to structure your response

## General Tips:
- Practice coding problems on a whiteboard
- Be ready to explain your thought process
- Ask clarifying questions before jumping into solutions

## Company Insights:
- Google values innovation and creative problem-solving
- Strong emphasis on collaboration and teamwork
- Fast-paced environment with continuous learning

## Role-Specific Advice:
- Be prepared for coding interviews in your preferred language
- Understand Google's engineering culture and practices
- Show enthusiasm for large-scale system challenges

## Practice Areas:
- Data structures and algorithms
- System design fundamentals
- Behavioral question responses using STAR method

Expected interview duration: 60-90 minutes including multiple rounds.
      `

      const result = await service.transform({
        content: aiResponseText,
        structured: true,
        jobDescription: 'Software Engineer at Google'
      })

      expect(typeof result.content).toBe('object')
      const parsed = result.content as InterviewPreparationResult
      
      expect(Array.isArray(parsed.questions)).toBe(true)
      expect(parsed.questions.length).toBeGreaterThan(0)
      expect(Array.isArray(parsed.generalTips)).toBe(true)
      expect(Array.isArray(parsed.companyInsights)).toBe(true)
      expect(Array.isArray(parsed.roleSpecificAdvice)).toBe(true)
      expect(typeof parsed.estimatedDuration).toBe('number')
      expect(typeof parsed.generatedAt).toBe('string')
    })

    test('should handle malformed AI responses gracefully', async () => {
      const malformedResponse = `
This is a malformed response that doesn't follow any clear structure.
There are no proper questions or sections.
Just some random text about interviews.
      `

      const result = await service.transform({
        content: malformedResponse,
        structured: true,
        jobDescription: 'Data Scientist at Netflix'
      })

      expect(typeof result.content).toBe('object')
      const parsed = result.content as InterviewPreparationResult
      
      // Should still produce valid structure with fallback content
      expect(Array.isArray(parsed.questions)).toBe(true)
      expect(parsed.questions.length).toBeGreaterThan(0) // Should have at least fallback questions
      expect(Array.isArray(parsed.generalTips)).toBe(true)
      expect(typeof parsed.estimatedDuration).toBe('number')
    })
  })

  describe('Context Extraction Integration', () => {
    test('should extract context from realistic job posting', () => {
      const jobPosting = `
Senior Software Engineer - Backend
Google Inc.

Google is seeking an experienced Senior Software Engineer to join our Backend Infrastructure team. 
You will be responsible for building and maintaining large-scale distributed systems that power 
Google's core products used by billions of users worldwide.

Requirements:
- 5+ years of experience in backend development
- Strong knowledge of distributed systems
- Experience with Go, Java, or C++
- BS/MS in Computer Science or equivalent

We offer competitive compensation, excellent benefits, and the opportunity to work on cutting-edge 
technology that impacts billions of users.
      `

      const context = service.extractJobContext(jobPosting)
      
      expect(context.company).toBe('Google Inc')
      expect(context.role).toBe('Senior Software Engineer')
    })

    test('should handle job postings with complex company names', () => {
      const jobPosting = `
Product Manager Role
Amazon Web Services (AWS), Inc.

Amazon Web Services is looking for a Product Manager to drive our cloud computing initiatives...
      `

      const context = service.extractJobContext(jobPosting)
      
      expect(context.company).toBe('Amazon Web Services (AWS)')
    })

    test('should handle job postings without clear company/role', () => {
      const vaguePosting = `
We're hiring! Looking for someone passionate about technology to join our team.
Competitive salary and great benefits. Apply now!
      `

      const context = service.extractJobContext(vaguePosting)
      
      // Should fall back to defaults
      expect(context.company).toBeTruthy()
      expect(context.role).toBeTruthy()
    })
  })

  describe('End-to-End Transformation Scenarios', () => {
    test('should handle complete workflow for tech company interview', async () => {
      const jobDescription = `
Staff Software Engineer
Meta (Facebook)

Meta is seeking a Staff Software Engineer to join our Infrastructure team. You will design and 
implement large-scale systems that support billions of users across our family of apps.
      `

      const aiResponse = `
# Interview Preparation for Staff Software Engineer at Meta

## Technical Questions:
1. How would you design a system to handle billions of users?
2. Explain how you would implement a distributed cache.
3. What's your experience with microservices architecture?

## Behavioral Questions:
1. Tell me about a time you led a technical project.
2. How do you handle disagreements with team members?
3. Describe a situation where you had to learn a new technology quickly.

## Tips:
- Be ready to discuss system design at scale
- Prepare examples of leadership and collaboration
- Know Meta's products and technical challenges

## Company Info:
- Meta focuses on connecting people globally
- Strong engineering culture with emphasis on impact
- Fast-paced environment with autonomous teams

The interview process typically takes 4-5 hours including multiple rounds.
      `

      const result = await service.transform({
        content: aiResponse,
        structured: true,
        jobDescription,
        isExistingContent: false
      })

      expect(typeof result.content).toBe('object')
      const parsed = result.content as InterviewPreparationResult
      
      // Verify comprehensive structure
      expect(parsed.questions.length).toBeGreaterThan(3)
      expect(parsed.generalTips.length).toBeGreaterThan(0)
      expect(parsed.companyInsights.length).toBeGreaterThan(0)
      expect(parsed.roleSpecificAdvice.length).toBeGreaterThan(0)
      expect(parsed.estimatedDuration).toBeGreaterThan(60)
      
      // Verify question categories
      const categories = parsed.questions.map(q => q.category)
      expect(categories).toContain('technical')
      expect(categories).toContain('behavioral')
    })

    test('should handle caching across multiple similar requests', async () => {
      const content = 'Standard interview preparation content'
      const jobDesc = 'Software Engineer at StartupCorp'

      // First request
      const result1 = await service.transform({
        content,
        structured: true,
        jobDescription: jobDesc
      })

      // Similar request should hit cache
      const result2 = await service.transform({
        content,
        structured: true,
        jobDescription: jobDesc
      })

      expect(result1.fromCache).toBe(false)
      expect(result2.fromCache).toBe(true)
      expect(result2.content).toEqual(result1.content)
    })

    test('should handle different content types consistently', async () => {
      const stringContent = 'Basic interview preparation advice'
      const structuredContent: InterviewPreparationResult = {
        questions: [
          {
            id: 'q1',
            category: 'behavioral',
            question: 'Why do you want this job?',
            suggestedApproach: 'Be honest and specific.',
            difficulty: 'easy'
          }
        ],
        generalTips: ['Prepare thoroughly'],
        companyInsights: ['Growing company'],
        roleSpecificAdvice: ['Know the tech stack'],
        practiceAreas: ['Common questions'],
        estimatedDuration: 30,
        generatedAt: new Date().toISOString()
      }

      const jobDesc = 'Frontend Developer at TechStartup'

      // Test string to structured
      const result1 = await service.transform({
        content: stringContent,
        structured: true,
        jobDescription: jobDesc
      })

      // Test structured to string  
      const result2 = await service.transform({
        content: structuredContent,
        structured: false,
        jobDescription: jobDesc
      })

      // Test structured to structured
      const result3 = await service.transform({
        content: structuredContent,
        structured: true,
        jobDescription: jobDesc
      })

      expect(typeof result1.content).toBe('object')
      expect(typeof result2.content).toBe('string')
      expect(typeof result3.content).toBe('object')
      expect(result3.content).toEqual(structuredContent)
    })
  })

  describe('Performance and Reliability', () => {
    test('should handle large AI responses efficiently', async () => {
      // Create a large but realistic AI response
      const largeResponse = `
# Comprehensive Interview Preparation

## Questions:
${Array.from({ length: 15 }, (_, i) => `
${i + 1}. Question ${i + 1}: What is your experience with technology ${i + 1}?
   Suggested approach: Discuss your background and provide specific examples.
`).join('')}

## General Tips:
${Array.from({ length: 10 }, (_, i) => `- Tip ${i + 1}: Important advice about interviews`).join('\n')}

## Company Insights:
${Array.from({ length: 8 }, (_, i) => `- Insight ${i + 1}: Key information about the company`).join('\n')}

## Role-Specific Advice:
${Array.from({ length: 6 }, (_, i) => `- Advice ${i + 1}: Important guidance for this role`).join('\n')}

## Practice Areas:
${Array.from({ length: 12 }, (_, i) => `- Area ${i + 1}: Important topic to practice`).join('\n')}

This is a comprehensive preparation that should take approximately 90 minutes to complete.
      `

      const startTime = Date.now()
      
      const result = await service.transform({
        content: largeResponse,
        structured: true,
        jobDescription: 'Senior Engineering Manager at BigTech Corp'
      })

      const endTime = Date.now()
      const transformationTime = endTime - startTime

      expect(typeof result.content).toBe('object')
      expect(transformationTime).toBeLessThan(5000) // Should complete within 5 seconds
      
      const parsed = result.content as InterviewPreparationResult
      expect(parsed.questions.length).toBeGreaterThan(5) // Should extract multiple questions
      expect(parsed.questions.length).toBeLessThanOrEqual(20) // But respect limits
    })

    test('should maintain consistency under rapid successive calls', async () => {
      const content = 'Consistent test content'
      const jobDesc = 'DevOps Engineer at CloudCorp'

      // Make 5 rapid successive calls
      const promises = Array.from({ length: 5 }, () =>
        service.transform({
          content,
          structured: true,
          jobDescription: jobDesc
        })
      )

      const results = await Promise.all(promises)

      // First should be fresh, rest should be cached
      expect(results[0].fromCache).toBe(false)
      
      // All should have identical content
      const firstContent = JSON.stringify(results[0].content)
      results.forEach(result => {
        expect(JSON.stringify(result.content)).toBe(firstContent)
      })
    })
  })

  describe('Error Recovery', () => {
    test('should recover from parser errors with graceful fallback', async () => {
      // Create content that might cause parsing issues
      const problematicContent = `
      Interview prep with weird formatting...
      
      Questions:
      - This is not a question
      - Neither is this
      
      Tips: None provided
      
      Duration: Not specified
      `

      const result = await service.transform({
        content: problematicContent,
        structured: true,
        jobDescription: 'Quality Assurance Engineer at TestCorp'
      })

      // Should still return valid structured content (either parsed or fallback)
      expect(typeof result.content).toBe('object')
      const parsed = result.content as InterviewPreparationResult
      
      expect(Array.isArray(parsed.questions)).toBe(true)
      expect(typeof parsed.estimatedDuration).toBe('number')
      expect(typeof parsed.generatedAt).toBe('string')
    })

    test('should handle memory pressure gracefully', async () => {
      // Create many different cache entries to test memory management
      const requests = Array.from({ length: 20 }, (_, i) => ({
        content: `Unique content ${i}`,
        structured: true,
        jobDescription: `Job ${i} at Company ${i}`
      }))

      // Process all requests
      const results = await Promise.all(
        requests.map(request => service.transform(request))
      )

      // All should complete successfully
      expect(results).toHaveLength(20)
      results.forEach(result => {
        expect(result.content).toBeDefined()
        expect(typeof result.transformationTime).toBe('number')
      })

      // Cache should be managed (not exceed limits)
      const stats = service.getCacheStats()
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize)
    })
  })
})