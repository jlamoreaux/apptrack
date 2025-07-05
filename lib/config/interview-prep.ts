/**
 * Interview Preparation Configuration
 * 
 * Centralized configuration for all interview prep related constants,
 * limits, and behavioral settings.
 */

export const INTERVIEW_PREP_CONFIG = {
  // Content parsing limits (security)
  PARSING: {
    MAX_JOB_DESCRIPTION_LENGTH: 5000,
    MAX_COMPANY_NAME_LENGTH: 100,
    MAX_ROLE_NAME_LENGTH: 100,
    MIN_COMPANY_NAME_LENGTH: 1,
    MIN_ROLE_NAME_LENGTH: 2,
  },

  // Default values
  DEFAULTS: {
    COMPANY_NAME: 'the company',
    ROLE_NAME: 'this position',
    ESTIMATED_DURATION: 30,
    FALLBACK_QUESTION_ID: 'fallback-1',
  },

  // Caching configuration
  CACHE: {
    EXPIRATION_MS: 24 * 60 * 60 * 1000, // 24 hours
    MAX_ENTRIES: 1000,
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  },

  // Validation constraints
  VALIDATION: {
    MIN_QUESTIONS: 1,
    MAX_QUESTIONS: 20,
    MIN_TIPS: 0,
    MAX_TIPS: 10,
    MIN_DURATION: 10,
    MAX_DURATION: 180,
    REQUIRED_QUESTION_FIELDS: ['id', 'question', 'category', 'difficulty', 'suggestedApproach'],
    VALID_CATEGORIES: ['behavioral', 'technical', 'company-specific', 'role-specific'] as const,
    VALID_DIFFICULTIES: ['easy', 'medium', 'hard'] as const,
  },

  // Content extraction patterns
  PATTERNS: {
    COMPANY_EXTRACTION: [
      /(?:at|with|for)\s+([A-Z][a-zA-Z\s&,.-]+?)(?:\s+is|,|\s+we|\s+located|\s+offers|\.)/i,
      /([A-Z][a-zA-Z\s&,.-]+?)\s+is\s+(?:seeking|looking|hiring)/i,
      /join\s+(?:our\s+team\s+at\s+)?([A-Z][a-zA-Z\s&,.-]+?)(?:\s+as|,|\.)/i,
    ],
    ROLE_EXTRACTION: [
      /(?:position|role|job)\s+(?:title|of|as)?\s*:?\s*([A-Z][a-zA-Z\s-]+?)(?:\s+at|\s+with|\s+for|,|\n|\.)/i,
      /(?:seeking|hiring|looking for)\s+an?\s+([A-Z][a-zA-Z\s-]+?)(?:\s+to|\s+who|\s+at|,|\n|\.)/i,
      /^([A-Z][a-zA-Z\s-]+?)(?:\s+at|\s+with|\s+for|\s+-|,|\n)/i,
    ],
    INVALID_NAME: /^\d+$/,
  },

  // Error messages
  ERROR_MESSAGES: {
    NO_CONTENT: 'No content provided for transformation',
    INVALID_CONTENT: 'Invalid content format',
    VALIDATION_FAILED: 'Content validation failed',
    PARSING_FAILED: 'Failed to parse content',
    CACHE_ERROR: 'Error accessing cache',
    CONTEXT_EXTRACTION_FAILED: 'Failed to extract job context',
    FALLBACK_CONTENT: 'Interview preparation content temporarily unavailable',
  },

  // Performance monitoring
  PERFORMANCE: {
    SLOW_TRANSFORMATION_MS: 1000,
    CACHE_HIT_RATE_WARNING: 0.5, // Warn if hit rate below 50%
    MAX_TRANSFORMATION_TIME_MS: 5000,
  },

  // Feature flags
  FEATURES: {
    ENABLE_CACHING: true,
    ENABLE_PERFORMANCE_MONITORING: true,
    ENABLE_DETAILED_LOGGING: false,
    ENABLE_CONTEXT_ENHANCEMENT: true,
    ENABLE_FALLBACK_VALIDATION: true,
  },
} as const

// Type exports for better type safety
export type InterviewPrepCategory = typeof INTERVIEW_PREP_CONFIG.VALIDATION.VALID_CATEGORIES[number]
export type InterviewPrepDifficulty = typeof INTERVIEW_PREP_CONFIG.VALIDATION.VALID_DIFFICULTIES[number]

// Validation helper functions
export const InterviewPrepValidation = {
  isValidCategory(category: string): category is InterviewPrepCategory {
    return INTERVIEW_PREP_CONFIG.VALIDATION.VALID_CATEGORIES.includes(category as InterviewPrepCategory)
  },

  isValidDifficulty(difficulty: string): difficulty is InterviewPrepDifficulty {
    return INTERVIEW_PREP_CONFIG.VALIDATION.VALID_DIFFICULTIES.includes(difficulty as InterviewPrepDifficulty)
  },

  isValidCompanyName(name: string): boolean {
    const config = INTERVIEW_PREP_CONFIG.PARSING
    return name.length >= config.MIN_COMPANY_NAME_LENGTH &&
           name.length < config.MAX_COMPANY_NAME_LENGTH &&
           !INTERVIEW_PREP_CONFIG.PATTERNS.INVALID_NAME.test(name)
  },

  isValidRoleName(name: string): boolean {
    const config = INTERVIEW_PREP_CONFIG.PARSING
    return name.length >= config.MIN_ROLE_NAME_LENGTH &&
           name.length < config.MAX_ROLE_NAME_LENGTH &&
           !INTERVIEW_PREP_CONFIG.PATTERNS.INVALID_NAME.test(name)
  },

  isValidDuration(duration: number): boolean {
    const config = INTERVIEW_PREP_CONFIG.VALIDATION
    return duration >= config.MIN_DURATION && duration <= config.MAX_DURATION
  },
}

// Environment-specific overrides
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV

  if (env === 'development') {
    return {
      ...INTERVIEW_PREP_CONFIG,
      FEATURES: {
        ...INTERVIEW_PREP_CONFIG.FEATURES,
        ENABLE_DETAILED_LOGGING: true,
      },
      CACHE: {
        ...INTERVIEW_PREP_CONFIG.CACHE,
        EXPIRATION_MS: 5 * 60 * 1000, // 5 minutes in dev
      },
    }
  }

  if (env === 'test') {
    return {
      ...INTERVIEW_PREP_CONFIG,
      CACHE: {
        ...INTERVIEW_PREP_CONFIG.CACHE,
        EXPIRATION_MS: 1000, // 1 second in tests
        MAX_ENTRIES: 10,
      },
      FEATURES: {
        ...INTERVIEW_PREP_CONFIG.FEATURES,
        ENABLE_CACHING: false, // Disable caching in tests for predictability
      },
    }
  }

  return INTERVIEW_PREP_CONFIG
}