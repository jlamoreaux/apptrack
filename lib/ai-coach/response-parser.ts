/**
 * Response Parser for AI Coach
 * Converts text responses into structured data when needed
 */

import type { 
  InterviewPreparationResult, 
  JobFitAnalysisResult,
  InterviewQuestion 
} from '@/types/ai-analysis'

/**
 * Parse interview preparation text into structured format
 */
export function parseInterviewPreparation(
  textResponse: string,
  context: { company: string; role: string }
): InterviewPreparationResult {
  try {
    // Try to parse as JSON first (in case AI returns structured data)
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return {
          ...parsed,
          generatedAt: new Date().toISOString()
        }
      }
    }
  } catch {
    // Fall through to text parsing
  }

  // Parse text response into structured format
  const questions = extractQuestionsFromText(textResponse, context)
  const sections = splitIntoSections(textResponse)
  
  return {
    questions,
    generalTips: extractTips(sections.tips || sections.general || ''),
    companyInsights: extractInsights(sections.company || sections.research || ''),
    roleSpecificAdvice: extractAdvice(sections.role || sections.specific || ''),
    practiceAreas: extractPracticeAreas(sections.practice || sections.preparation || ''),
    estimatedDuration: Math.max(questions.length * 3, 30), // 3 min per question, min 30
    generatedAt: new Date().toISOString()
  }
}

/**
 * Parse job fit analysis text into structured format
 */
export function parseJobFitAnalysis(
  textResponse: string,
  context: { company: string; role: string }
): JobFitAnalysisResult {
  try {
    // Try to parse as JSON first
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.overallScore && parsed.strengths) {
        return {
          ...parsed,
          generatedAt: new Date().toISOString()
        }
      }
    }
  } catch {
    // Fall through to text parsing
  }

  // Parse text response
  const score = extractScore(textResponse)
  const sections = splitIntoSections(textResponse)
  
  return {
    overallScore: score,
    scoreLabel: getScoreLabel(score),
    strengths: extractStrengths(sections.strengths || sections.pros || ''),
    weaknesses: extractWeaknesses(sections.weaknesses || sections.cons || sections.gaps || ''),
    recommendations: extractRecommendations(sections.recommendations || sections.suggestions || ''),
    keyRequirements: extractRequirements(sections.requirements || sections.skills || ''),
    matchDetails: {
      skillsMatch: extractSubScore(textResponse, 'skills'),
      experienceMatch: extractSubScore(textResponse, 'experience'),
      educationMatch: extractSubScore(textResponse, 'education')
    },
    generatedAt: new Date().toISOString()
  }
}

/**
 * Extract interview questions from text
 */
function extractQuestionsFromText(
  text: string,
  context: { company: string; role: string }
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = []
  
  // Look for numbered questions or Q: patterns
  const questionPatterns = [
    /(?:^|\n)\s*(\d+\.?\s*)?(?:Q:|Question:?)?\s*([^\n]+(?:\?|:))/gim,
    /(?:^|\n)\s*[-•]\s*([^\n]+\?)/gim
  ]
  
  let questionId = 1
  
  for (const pattern of questionPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const questionText = (match[2] || match[1]).trim()
      
      if (questionText.length > 10 && questionText.includes('?')) {
        questions.push({
          id: `q${questionId}`,
          category: categorizeQuestion(questionText, context),
          question: questionText,
          suggestedApproach: extractApproachForQuestion(text, questionText),
          difficulty: determineDifficulty(questionText)
        })
        questionId++
      }
    }
  }
  
  // If no questions found, create some basic ones
  if (questions.length === 0) {
    questions.push(
      {
        id: 'q1',
        category: 'behavioral',
        question: 'Tell me about yourself and your background.',
        suggestedApproach: 'Provide a brief professional summary highlighting relevant experience.',
        difficulty: 'easy'
      },
      {
        id: 'q2',
        category: 'company-specific',
        question: `Why do you want to work at ${context.company}?`,
        suggestedApproach: 'Research the company and connect their mission to your career goals.',
        difficulty: 'easy'
      }
    )
  }
  
  return questions.slice(0, 12) // Limit to reasonable number
}

/**
 * Categorize a question based on its content
 */
function categorizeQuestion(question: string, context: { role: string }): InterviewQuestion['category'] {
  const lowerQ = question.toLowerCase()
  const lowerRole = context.role.toLowerCase()
  
  if (lowerQ.includes('tell me about') || lowerQ.includes('describe a time') || lowerQ.includes('example of')) {
    return 'behavioral'
  }
  
  if (lowerQ.includes('company') || lowerQ.includes('organization') || lowerQ.includes('why do you want')) {
    return 'company-specific'
  }
  
  if (lowerQ.includes('technical') || lowerQ.includes('code') || lowerQ.includes('system') || 
      (lowerRole.includes('engineer') && (lowerQ.includes('debug') || lowerQ.includes('algorithm')))) {
    return 'technical'
  }
  
  return 'role-specific'
}

/**
 * Determine question difficulty
 */
function determineDifficulty(question: string): InterviewQuestion['difficulty'] {
  const lowerQ = question.toLowerCase()
  
  if (lowerQ.includes('tell me about yourself') || lowerQ.includes('why do you want')) {
    return 'easy'
  }
  
  if (lowerQ.includes('describe a time') || lowerQ.includes('complex') || lowerQ.includes('challenge')) {
    return 'medium'
  }
  
  if (lowerQ.includes('design') || lowerQ.includes('architecture') || lowerQ.includes('conflict')) {
    return 'hard'
  }
  
  return 'medium'
}

/**
 * Extract approach for a specific question from the full text
 */
function extractApproachForQuestion(fullText: string, question: string): string {
  // Look for advice/approach text near the question
  const lines = fullText.split('\n')
  const questionIndex = lines.findIndex(line => line.includes(question.substring(0, 30)))
  
  if (questionIndex >= 0) {
    // Look in next few lines for approach/answer guidance
    for (let i = questionIndex + 1; i < Math.min(questionIndex + 4, lines.length); i++) {
      const line = lines[i].trim()
      if (line.length > 20 && !line.includes('?')) {
        return line
      }
    }
  }
  
  return 'Structure your response clearly and provide specific examples when possible.'
}

/**
 * Split text into sections based on common headers
 */
function splitIntoSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = text.split('\n')
  
  let currentSection = 'general'
  let currentContent: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()
    
    // Check for section headers
    if (isHeaderLine(trimmed)) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim()
      }
      
      // Start new section
      currentSection = extractSectionName(trimmed)
      currentContent = []
    } else if (trimmed.length > 0) {
      currentContent.push(line)
    }
  }
  
  // Save final section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim()
  }
  
  return sections
}

/**
 * Check if a line is a section header
 */
function isHeaderLine(line: string): boolean {
  const headerPatterns = [
    /^#+\s/,  // Markdown headers
    /.*:$/,   // Lines ending with colon
    /^\d+\.\s*[a-z\s]+:?$/,  // Numbered sections
    /^[a-z\s]+:$/  // Simple headers
  ]
  
  return headerPatterns.some(pattern => pattern.test(line)) && line.length < 60
}

/**
 * Extract section name from header line
 */
function extractSectionName(headerLine: string): string {
  let name = headerLine.replace(/^#+\s*/, '').replace(/:$/, '').replace(/^\d+\.\s*/, '')
  
  // Map common variations to standard names
  const mappings: Record<string, string> = {
    'tips': 'tips',
    'general tips': 'tips',
    'interview tips': 'tips',
    'company': 'company',
    'company info': 'company',
    'company research': 'company',
    'strengths': 'strengths',
    'your strengths': 'strengths',
    'advantages': 'strengths',
    'weaknesses': 'weaknesses',
    'areas for improvement': 'weaknesses',
    'gaps': 'weaknesses',
    'recommendations': 'recommendations',
    'suggestions': 'recommendations',
    'advice': 'recommendations',
    'requirements': 'requirements',
    'key requirements': 'requirements',
    'skills needed': 'requirements',
    'practice': 'practice',
    'practice areas': 'practice',
    'preparation': 'practice'
  }
  
  return mappings[name] || name
}

/**
 * Extract tips from text section
 */
function extractTips(text: string): string[] {
  return extractBulletPoints(text).slice(0, 8)
}

/**
 * Extract insights from text section
 */
function extractInsights(text: string): string[] {
  return extractBulletPoints(text).slice(0, 6)
}

/**
 * Extract advice from text section
 */
function extractAdvice(text: string): string[] {
  return extractBulletPoints(text).slice(0, 6)
}

/**
 * Extract practice areas from text section
 */
function extractPracticeAreas(text: string): string[] {
  return extractBulletPoints(text).slice(0, 8)
}

/**
 * Extract strengths from text section
 */
function extractStrengths(text: string): string[] {
  return extractBulletPoints(text).slice(0, 5)
}

/**
 * Extract weaknesses from text section
 */
function extractWeaknesses(text: string): string[] {
  return extractBulletPoints(text).slice(0, 4)
}

/**
 * Extract recommendations from text section
 */
function extractRecommendations(text: string): string[] {
  return extractBulletPoints(text).slice(0, 6)
}

/**
 * Extract requirements from text section
 */
function extractRequirements(text: string): string[] {
  return extractBulletPoints(text).slice(0, 8)
}

/**
 * Extract bullet points from text
 */
function extractBulletPoints(text: string): string[] {
  if (!text) return []
  
  const points: string[] = []
  const lines = text.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Look for bullet points, numbered lists, or sentences
    if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/) || 
        (trimmed.length > 10 && !isHeaderLine(trimmed.toLowerCase()))) {
      const cleaned = trimmed
        .replace(/^[-•*]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim()
      
      if (cleaned.length > 5) {
        points.push(cleaned)
      }
    }
  }
  
  // If no bullet points found, split by sentences
  if (points.length === 0) {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
    points.push(...sentences.slice(0, 5))
  }
  
  return points
}

/**
 * Extract overall score from text
 */
function extractScore(text: string): number {
  // Look for percentage or score patterns
  const patterns = [
    /(\d+)%/g,
    /score:?\s*(\d+)/gi,
    /rating:?\s*(\d+)/gi,
    /(\d+)\s*(?:out of|\/)\s*(?:10|100)/gi
  ]
  
  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern))
    for (const match of matches) {
      const score = parseInt(match[1])
      if (score >= 0 && score <= 100) {
        return score
      }
      if (score >= 0 && score <= 10) {
        return score * 10 // Convert 0-10 scale to 0-100
      }
    }
  }
  
  // Default based on sentiment
  if (text.toLowerCase().includes('excellent') || text.toLowerCase().includes('outstanding')) {
    return 90
  }
  if (text.toLowerCase().includes('strong') || text.toLowerCase().includes('good match')) {
    return 80
  }
  if (text.toLowerCase().includes('fair') || text.toLowerCase().includes('decent')) {
    return 70
  }
  
  return 75 // Default score
}

/**
 * Get score label based on numeric score
 */
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent Match'
  if (score >= 80) return 'Strong Match'
  if (score >= 70) return 'Good Match'
  if (score >= 60) return 'Fair Match'
  return 'Poor Match'
}

/**
 * Extract sub-scores for specific categories
 */
function extractSubScore(text: string, category: string): number {
  const categoryPattern = new RegExp(`${category}:?\\s*(\\d+)%?`, 'i')
  const match = text.match(categoryPattern)
  
  if (match) {
    const score = parseInt(match[1])
    if (score <= 10) return score * 10
    if (score <= 100) return score
  }
  
  // Default based on overall context
  const baseScore = extractScore(text)
  const variation = Math.floor(Math.random() * 20) - 10 // ±10 variation
  return Math.max(50, Math.min(100, baseScore + variation))
}