/**
 * AI Analysis System Configuration Constants
 * Centralized configuration for all AI-related limits and thresholds
 */

// Content validation limits
export const CONTENT_LIMITS = {
  JOB_DESCRIPTION: {
    MIN_LENGTH: 50,
    MAX_LENGTH: 20000,
  },
  RESUME_TEXT: {
    MIN_LENGTH: 100,
    MAX_LENGTH: 50000,
  },
  COVER_LETTER: {
    MIN_LENGTH: 200,
    MAX_LENGTH: 5000,
  },
} as const;

// Timeout configurations (in milliseconds)
export const TIMEOUT_CONFIG = {
  AI_ANALYSIS: 120000, // 2 minutes
  HISTORY_FETCH: 30000, // 30 seconds
  RESUME_UPLOAD: 60000, // 1 minute
  PDF_GENERATION: 15000, // 15 seconds
  DEBOUNCE_DELAY: 1000, // 1 second
} as const;

// Score thresholds for analysis results
export const SCORE_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 75,
  FAIR: 65,
  NEEDS_IMPROVEMENT: 50,
} as const;

// Analysis refresh suggestions
export const REFRESH_THRESHOLDS = {
  SUGGEST_REFRESH_DAYS: 7, // Suggest refresh after 7 days
  FORCE_REFRESH_DAYS: 30, // Force refresh after 30 days
} as const;

// Rate limiting configurations
export const RATE_LIMITS = {
  AI_ANALYSIS: {
    REQUESTS_PER_MINUTE: 5,
    BURST_REQUESTS: 2,
    BURST_WINDOW_SECONDS: 10,
  },
  GENERAL_API: {
    REQUESTS_PER_MINUTE: 100,
    REQUESTS_PER_HOUR: 1000,
  },
} as const;

// UI/UX configurations
export const UI_CONFIG = {
  ANALYSIS_POLLING_INTERVAL: 5000, // 5 seconds
  TOAST_DURATION: 3000, // 3 seconds
  LOADING_MIN_DISPLAY_TIME: 1000, // 1 second minimum loading display
  ACCESSIBILITY_ANNOUNCEMENT_DELAY: 500, // 500ms delay for screen readers
} as const;

// File size limits
export const FILE_LIMITS = {
  RESUME_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  PDF_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_FORMATS: ['.pdf', '.doc', '.docx', '.txt'] as const,
} as const;

// Analysis types and configurations
export const ANALYSIS_TYPES = {
  JOB_FIT: {
    MIN_PROCESSING_TIME: 5000, // Minimum 5 seconds for better UX
    MAX_PROCESSING_TIME: 90000, // Maximum 90 seconds
    CACHE_DURATION: 3600000, // 1 hour cache
  },
  INTERVIEW_PREP: {
    MIN_PROCESSING_TIME: 3000,
    MAX_PROCESSING_TIME: 60000,
    CACHE_DURATION: 1800000, // 30 minutes cache
  },
  COVER_LETTER: {
    MIN_PROCESSING_TIME: 3000,
    MAX_PROCESSING_TIME: 45000,
    CACHE_DURATION: 1800000, // 30 minutes cache
  },
} as const;

// Error retry configurations
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2, // Exponential backoff
  MAX_DELAY: 10000, // Maximum 10 seconds between retries
} as const;

// Accessibility configurations
export const A11Y_CONFIG = {
  FOCUS_TRAP_DELAY: 100,
  KEYBOARD_NAV_DELAY: 50,
  SCREEN_READER_DELAY: 300,
  COLOR_CONTRAST_RATIO: 4.5, // WCAG AA standard
} as const;

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  COMPONENT_RENDER_WARNING: 100, // Warn if component renders take >100ms
  API_RESPONSE_WARNING: 3000, // Warn if API responses take >3s
  MEMORY_USAGE_WARNING: 50 * 1024 * 1024, // Warn if memory usage >50MB
} as const;

// Development/debugging configurations
export const DEBUG_CONFIG = {
  VERBOSE_LOGGING: process.env.NODE_ENV === 'development',
  PERFORMANCE_LOGGING: process.env.NODE_ENV === 'development',
  ERROR_DETAILS_IN_RESPONSE: process.env.NODE_ENV === 'development',
} as const;