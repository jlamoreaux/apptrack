/**
 * Comprehensive tests for lib/ai-coach/response-parser.ts
 *
 * KNOWN BUGS DOCUMENTED (do not change source code):
 * 1. In parseJobFitAnalysis text-parsing fallback, `keyRequirements` is typed as
 *    `RequirementMatch[]` but extractRequirements() returns `string[]`. TypeScript
 *    should flag this. At runtime the array contains strings, not RequirementMatch objects.
 * 2. `overallScore` is NOT explicitly clamped to [0, 100] in the JSON parse path —
 *    if the AI returns `overallScore: 150`, it will be returned as-is. The clamping
 *    only happens inside `extractScore()` (text-parsing path).
 * 3. `parseJobFitAnalysis` JSON path only checks `parsed.overallScore && parsed.strengths`
 *    — a score of 0 is falsy, so a response with score=0 falls through to text-parsing.
 */

// @jest-environment node

import { describe, it, expect } from '@jest/globals';
import {
  parseInterviewPreparation,
  parseJobFitAnalysis,
} from '@/lib/ai-coach/response-parser';
import type {
  InterviewPreparationResult,
  JobFitAnalysisResult,
  InterviewQuestion,
} from '@/types/ai-analysis';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const defaultContext = { company: 'Acme Corp', role: 'Software Engineer' };

/** Check that a string is a valid ISO-8601 date string */
function isValidISOString(s: string): boolean {
  return !isNaN(Date.parse(s)) && typeof s === 'string' && s.includes('T');
}

// ─────────────────────────────────────────────────────────────────────────────
// parseInterviewPreparation
// ─────────────────────────────────────────────────────────────────────────────

describe('parseInterviewPreparation', () => {
  // ── JSON in markdown code block ──────────────────────────────────────────

  describe('when given JSON wrapped in a markdown code block', () => {
    const sampleQuestions: InterviewQuestion[] = [
      {
        id: 'q1',
        category: 'behavioral',
        question: 'Tell me about a time you led a project.',
        suggestedApproach: 'Use the STAR framework.',
        difficulty: 'medium',
      },
      {
        id: 'q2',
        category: 'technical',
        question: 'How do you optimise a slow database query?',
        suggestedApproach: 'Discuss indexes, query plans, caching.',
        difficulty: 'hard',
      },
    ];

    const payload = {
      questions: sampleQuestions,
      generalTips: ['Research the company beforehand.'],
      companyInsights: ['Acme Corp values innovation.'],
      roleSpecificAdvice: ['Brush up on system design.'],
      practiceAreas: ['Algorithms', 'Behavioural questions'],
      estimatedDuration: 60,
      generatedAt: '2025-01-15T10:00:00.000Z',
    };

    const textWithCodeBlock = `Here are your interview questions:\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;

    it('returns questions array from JSON code block', () => {
      const result = parseInterviewPreparation(textWithCodeBlock, defaultContext);
      expect(Array.isArray(result.questions)).toBe(true);
      expect(result.questions).toHaveLength(2);
    });

    it('preserves question shape (id, category, question, suggestedApproach, difficulty)', () => {
      const result = parseInterviewPreparation(textWithCodeBlock, defaultContext);
      const q = result.questions[0];
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('category');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('suggestedApproach');
      expect(q).toHaveProperty('difficulty');
    });

    it('uses the generatedAt from the JSON payload when present', () => {
      const result = parseInterviewPreparation(textWithCodeBlock, defaultContext);
      expect(result.generatedAt).toBe('2025-01-15T10:00:00.000Z');
    });

    it('fills in generatedAt when the JSON payload omits it', () => {
      const payloadWithoutDate = { ...payload };
      delete (payloadWithoutDate as any).generatedAt;
      const text = `\`\`\`json\n${JSON.stringify(payloadWithoutDate)}\n\`\`\``;
      const result = parseInterviewPreparation(text, defaultContext);
      expect(isValidISOString(result.generatedAt)).toBe(true);
    });

    it('returns a full InterviewPreparationResult shape', () => {
      const result = parseInterviewPreparation(textWithCodeBlock, defaultContext);
      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('generalTips');
      expect(result).toHaveProperty('companyInsights');
      expect(result).toHaveProperty('roleSpecificAdvice');
      expect(result).toHaveProperty('practiceAreas');
      expect(result).toHaveProperty('estimatedDuration');
      expect(result).toHaveProperty('generatedAt');
    });

    it('also parses a plain ``` code block (without json hint)', () => {
      const plain = `\`\`\`\n${JSON.stringify(payload)}\n\`\`\``;
      const result = parseInterviewPreparation(plain, defaultContext);
      expect(Array.isArray(result.questions)).toBe(true);
      expect(result.questions).toHaveLength(2);
    });
  });

  // ── Plain JSON string (no code block) ────────────────────────────────────

  describe('when given a plain JSON string (no markdown)', () => {
    const plainPayload = {
      questions: [
        {
          id: 'q1',
          category: 'behavioral' as const,
          question: 'Describe your greatest strength.',
          suggestedApproach: 'Be specific and honest.',
          difficulty: 'easy' as const,
        },
      ],
      generalTips: ['Arrive 10 minutes early.'],
      companyInsights: [],
      roleSpecificAdvice: [],
      practiceAreas: [],
      estimatedDuration: 45,
    };

    it('parses JSON object embedded in a text string', () => {
      const text = `Here is some info. ${JSON.stringify(plainPayload)} Hope that helps.`;
      const result = parseInterviewPreparation(text, defaultContext);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question).toBe('Describe your greatest strength.');
    });

    it('generatedAt is a valid ISO string when missing from plain JSON', () => {
      const text = JSON.stringify(plainPayload);
      const result = parseInterviewPreparation(text, defaultContext);
      expect(isValidISOString(result.generatedAt)).toBe(true);
    });
  });

  // ── Text parsing fallback ─────────────────────────────────────────────────

  describe('text-parsing fallback (no JSON in response)', () => {
    const textResponse = `
## Interview Tips:
- Prepare concrete examples for each question.
- Research the company culture.

## Questions
1. Tell me about yourself?
2. Why do you want to work here?
3. Describe a challenging project you overcame?

## Company Research:
- Acme Corp was founded in 1985.

## Practice Areas:
- Communication skills
- Problem-solving
`;

    it('falls back gracefully and returns an object (not null/undefined)', () => {
      const result = parseInterviewPreparation(textResponse, defaultContext);
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
    });

    it('extracts questions array from numbered/bullet text', () => {
      const result = parseInterviewPreparation(textResponse, defaultContext);
      expect(Array.isArray(result.questions)).toBe(true);
      // At minimum the fallback injects 2 default questions when none found
      expect(result.questions.length).toBeGreaterThanOrEqual(1);
    });

    it('estimatedDuration is at least 30 minutes', () => {
      const result = parseInterviewPreparation(textResponse, defaultContext);
      expect(result.estimatedDuration).toBeGreaterThanOrEqual(30);
    });

    it('returns arrays for tips, insights, advice, practiceAreas', () => {
      const result = parseInterviewPreparation(textResponse, defaultContext);
      expect(Array.isArray(result.generalTips)).toBe(true);
      expect(Array.isArray(result.companyInsights)).toBe(true);
      expect(Array.isArray(result.roleSpecificAdvice)).toBe(true);
      expect(Array.isArray(result.practiceAreas)).toBe(true);
    });

    it('generatedAt is a valid ISO string in fallback path', () => {
      const result = parseInterviewPreparation(textResponse, defaultContext);
      expect(isValidISOString(result.generatedAt)).toBe(true);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty string input without throwing', () => {
      expect(() => parseInterviewPreparation('', defaultContext)).not.toThrow();
    });

    it('returns valid shape for empty string', () => {
      const result = parseInterviewPreparation('', defaultContext);
      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('estimatedDuration');
      expect(result).toHaveProperty('generatedAt');
    });

    it('estimatedDuration is at least 30 for empty string (default questions injected)', () => {
      const result = parseInterviewPreparation('', defaultContext);
      expect(result.estimatedDuration).toBeGreaterThanOrEqual(30);
    });

    it('handles garbage text without throwing', () => {
      const garbage = '!@#$%^&*()_+{}|:<>?~`±§';
      expect(() => parseInterviewPreparation(garbage, defaultContext)).not.toThrow();
    });

    it('returns valid shape for garbage input', () => {
      const result = parseInterviewPreparation('!@#$%^&*()_+', defaultContext);
      expect(Array.isArray(result.questions)).toBe(true);
      expect(typeof result.estimatedDuration).toBe('number');
      expect(isValidISOString(result.generatedAt)).toBe(true);
    });

    it('injects default questions mentioning company name when no questions found', () => {
      const result = parseInterviewPreparation('', defaultContext);
      const allText = result.questions.map(q => q.question).join(' ');
      expect(allText).toContain(defaultContext.company);
    });

    it('limits questions to at most 12', () => {
      // Provide text with many questions
      const manyQs = Array.from({ length: 20 }, (_, i) => `${i + 1}. What is question number ${i + 1}?`).join('\n');
      const result = parseInterviewPreparation(manyQs, defaultContext);
      expect(result.questions.length).toBeLessThanOrEqual(12);
    });

    it('handles malformed JSON code block gracefully (falls back to text parsing)', () => {
      const broken = '```json\n{ "questions": [invalid json }\n```';
      expect(() => parseInterviewPreparation(broken, defaultContext)).not.toThrow();
      const result = parseInterviewPreparation(broken, defaultContext);
      expect(Array.isArray(result.questions)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseJobFitAnalysis
// ─────────────────────────────────────────────────────────────────────────────

describe('parseJobFitAnalysis', () => {
  // ── JSON parsing path ─────────────────────────────────────────────────────

  describe('when given a valid JSON response', () => {
    const payload = {
      overallScore: 85,
      scoreLabel: 'Strong Match',
      strengths: ['5 years React experience', 'Strong communication'],
      weaknesses: ['Limited DevOps exposure'],
      recommendations: ['Take a Docker course.'],
      keyRequirements: [
        { requirement: 'React', status: 'met', evidence: 'Listed in resume' },
      ],
      matchDetails: {
        skillsMatch: 90,
        experienceMatch: 80,
        educationMatch: 75,
      },
      generatedAt: '2025-03-01T12:00:00.000Z',
    };

    it('parses JSON object from response text', () => {
      const text = JSON.stringify(payload);
      const result = parseJobFitAnalysis(text, defaultContext);
      expect(result.overallScore).toBe(85);
      expect(result.strengths).toEqual(['5 years React experience', 'Strong communication']);
    });

    it('always overwrites generatedAt with current time (JSON path)', () => {
      // BUG NOTE: The JSON parsing path always sets generatedAt = new Date().toISOString()
      // regardless of what is in the payload. This differs from parseInterviewPreparation
      // which preserves the payload's generatedAt.
      const text = JSON.stringify(payload);
      const before = Date.now();
      const result = parseJobFitAnalysis(text, defaultContext);
      const after = Date.now();
      const resultTime = new Date(result.generatedAt).getTime();
      expect(isValidISOString(result.generatedAt)).toBe(true);
      expect(resultTime).toBeGreaterThanOrEqual(before);
      expect(resultTime).toBeLessThanOrEqual(after);
    });

    it('returns all required fields in result', () => {
      const text = JSON.stringify(payload);
      const result = parseJobFitAnalysis(text, defaultContext);
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('scoreLabel');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('weaknesses');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('keyRequirements');
      expect(result).toHaveProperty('matchDetails');
      expect(result).toHaveProperty('generatedAt');
    });

    it('matchDetails has skillsMatch, experienceMatch, educationMatch', () => {
      const text = JSON.stringify(payload);
      const result = parseJobFitAnalysis(text, defaultContext);
      expect(result.matchDetails).toHaveProperty('skillsMatch');
      expect(result.matchDetails).toHaveProperty('experienceMatch');
      expect(result.matchDetails).toHaveProperty('educationMatch');
    });

    it('parses JSON even when surrounded by prose', () => {
      const text = `Analysis complete! ${JSON.stringify(payload)} Let me know if you have questions.`;
      const result = parseJobFitAnalysis(text, defaultContext);
      expect(result.overallScore).toBe(85);
    });
  });

  // ── Text parsing fallback ─────────────────────────────────────────────────

  describe('text-parsing fallback (no JSON)', () => {
    const textResponse = `
## Job Fit Analysis for Software Engineer at Acme Corp

Overall Score: 78%

## Strengths:
- Strong React knowledge
- Excellent problem-solving skills

## Weaknesses / Gaps:
- Limited cloud experience
- No formal CS degree

## Recommendations:
- Take an AWS certification course
- Build a portfolio project using cloud services

## Key Requirements:
- React (required)
- Node.js (required)
`;

    it('falls back gracefully and returns an object (not null/undefined)', () => {
      const result = parseJobFitAnalysis(textResponse, defaultContext);
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
    });

    it('extracts a numeric overall score from text', () => {
      const result = parseJobFitAnalysis(textResponse, defaultContext);
      expect(typeof result.overallScore).toBe('number');
      expect(result.overallScore).toBe(78);
    });

    it('scoreLabel is a non-empty string', () => {
      const result = parseJobFitAnalysis(textResponse, defaultContext);
      expect(typeof result.scoreLabel).toBe('string');
      expect(result.scoreLabel.length).toBeGreaterThan(0);
    });

    it('generatedAt is a valid ISO string in fallback path', () => {
      const result = parseJobFitAnalysis(textResponse, defaultContext);
      expect(isValidISOString(result.generatedAt)).toBe(true);
    });

    it('returns arrays for strengths, weaknesses, recommendations', () => {
      const result = parseJobFitAnalysis(textResponse, defaultContext);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  // ── Score labels ──────────────────────────────────────────────────────────

  describe('score label mapping (via parseJobFitAnalysis)', () => {
    /**
     * BUG NOTE: The JSON parse path in parseJobFitAnalysis spreads the raw
     * parsed object (`...parsed`) without recomputing `scoreLabel`. So if the
     * AI JSON omits `scoreLabel` the returned object has `scoreLabel: undefined`.
     *
     * To reliably test the `getScoreLabel` logic we must use the text-parsing
     * fallback path, which calls `getScoreLabel(extractScore(text))` explicitly.
     * We do that here by providing plain-text strings (no JSON) containing a
     * percentage that extractScore() can parse.
     */
    function getLabel(score: number): string {
      // Plain text with no JSON — triggers text-parsing path which calls getScoreLabel
      const text = `Your fit score is ${score}% for this position.`;
      return parseJobFitAnalysis(text, defaultContext).scoreLabel;
    }

    it('score >= 90 → "Excellent Match"', () => {
      expect(getLabel(90)).toBe('Excellent Match');
      expect(getLabel(95)).toBe('Excellent Match');
      expect(getLabel(100)).toBe('Excellent Match');
    });

    it('score >= 80 and < 90 → "Strong Match"', () => {
      expect(getLabel(80)).toBe('Strong Match');
      expect(getLabel(85)).toBe('Strong Match');
      expect(getLabel(89)).toBe('Strong Match');
    });

    it('score >= 70 and < 80 → "Good Match"', () => {
      expect(getLabel(70)).toBe('Good Match');
      expect(getLabel(75)).toBe('Good Match');
      expect(getLabel(79)).toBe('Good Match');
    });

    it('score >= 60 and < 70 → "Fair Match"', () => {
      expect(getLabel(60)).toBe('Fair Match');
      expect(getLabel(65)).toBe('Fair Match');
      expect(getLabel(69)).toBe('Fair Match');
    });

    it('score < 60 → "Poor Match"', () => {
      expect(getLabel(59)).toBe('Poor Match');
      expect(getLabel(30)).toBe('Poor Match');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty string input without throwing', () => {
      expect(() => parseJobFitAnalysis('', defaultContext)).not.toThrow();
    });

    it('returns valid shape for empty string', () => {
      const result = parseJobFitAnalysis('', defaultContext);
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('scoreLabel');
      expect(result).toHaveProperty('generatedAt');
    });

    it('handles garbage text without throwing', () => {
      expect(() => parseJobFitAnalysis('!@#$%^&*(){}|', defaultContext)).not.toThrow();
    });

    it('returns valid shape for garbage input', () => {
      const result = parseJobFitAnalysis('!@#$%^&*()', defaultContext);
      expect(typeof result.overallScore).toBe('number');
      expect(isValidISOString(result.generatedAt)).toBe(true);
    });

    it('extracts score from "X out of 100" pattern in text', () => {
      const text = 'Your overall fit is 72 out of 100 for this role.';
      const result = parseJobFitAnalysis(text, defaultContext);
      expect(result.overallScore).toBe(72);
    });

    it('extracts score from percentage pattern in text', () => {
      const text = 'You match 88% of the job requirements.';
      const result = parseJobFitAnalysis(text, defaultContext);
      expect(result.overallScore).toBe(88);
    });

    it('defaults to 75 when no score signals found', () => {
      // Plain prose with no numbers, no sentiment words
      const result = parseJobFitAnalysis('You submitted an application.', defaultContext);
      expect(result.overallScore).toBe(75);
    });

    it('handles malformed JSON gracefully (falls back to text parsing)', () => {
      const broken = '{ "overallScore": 80, "strengths": [invalid }';
      expect(() => parseJobFitAnalysis(broken, defaultContext)).not.toThrow();
    });
  });
});
