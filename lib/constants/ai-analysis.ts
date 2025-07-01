/**
 * Configuration constants for AI Analysis features
 * Centralized configuration for maintainability and extensibility
 */

import { AIFeatureConfig, AIAnalysisConfig, ErrorType } from "@/types/ai-analysis"

// API Endpoints
export const AI_ANALYSIS_ENDPOINTS = {
  JOB_FIT: '/api/ai/job-fit-analysis',
  INTERVIEW_PREP: '/api/ai/interview-preparation',
  COVER_LETTER: '/api/ai/cover-letter',
} as const

// Cache configuration
export const CACHE_CONFIG = {
  EXPIRATION_MS: 30 * 60 * 1000, // 30 minutes
  MAX_ENTRIES: 50,
  STORAGE_KEY: 'ai_analysis_cache',
} as const

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_FACTOR: 2,
} as const

// Error messages by type
export const ERROR_MESSAGES: Record<ErrorType, string> = {
  network: 'Network error. Please check your connection and try again.',
  auth: 'Authentication error. Please refresh the page and try again.',
  server: 'Server error. Our team has been notified. Please try again later.',
  validation: 'Invalid data provided. Please check your application details.',
  unknown: 'An unexpected error occurred. Please try again.',
}

// Retryable error types
export const RETRYABLE_ERRORS: Set<ErrorType> = new Set(['network', 'server'])

// AI Feature configurations
export const AI_FEATURES: AIFeatureConfig[] = [
  {
    id: 'job-fit',
    label: 'Job Fit Analysis',
    icon: 'Target',
    description: 'AI-powered match analysis for this role',
    endpoint: AI_ANALYSIS_ENDPOINTS.JOB_FIT,
    requiresJobDescription: true,
    estimatedTime: 15,
  },
  {
    id: 'interview',
    label: 'Interview Prep',
    icon: 'MessageCircle',
    description: 'Custom interview questions and guidance',
    endpoint: AI_ANALYSIS_ENDPOINTS.INTERVIEW_PREP,
    requiresJobDescription: false,
    estimatedTime: 20,
  },
  {
    id: 'cover-letter',
    label: 'Cover Letter',
    icon: 'FileText',
    description: 'Generate tailored cover letter',
    endpoint: AI_ANALYSIS_ENDPOINTS.COVER_LETTER,
    requiresJobDescription: false,
    estimatedTime: 10,
  },
]

// Feature lookup map for O(1) access
export const AI_FEATURES_MAP = new Map(
  AI_FEATURES.map(feature => [feature.id, feature])
)

// Main configuration object
export const AI_ANALYSIS_CONFIG: AIAnalysisConfig = {
  features: AI_FEATURES,
  cacheExpiration: CACHE_CONFIG.EXPIRATION_MS,
  maxRetries: RETRY_CONFIG.MAX_ATTEMPTS,
  retryDelay: RETRY_CONFIG.BASE_DELAY_MS,
}

// Upgrade prompt configuration
export const UPGRADE_PROMPT_CONFIG = {
  title: 'AI Coach Features',
  description: 'Unlock powerful AI-driven insights for this application',
  features: [
    'Personalized job fit scoring',
    'Role-specific interview questions',
    'Custom cover letter generation',
    'AI-powered career recommendations',
  ],
  upgradeUrl: '/dashboard/upgrade',
  buttonText: 'Upgrade to AI Coach',
} as const

// Accessibility configuration
export const A11Y_CONFIG = {
  tablistLabel: 'AI Analysis Features',
  loadingLabel: 'AI is analyzing your application',
  errorLabel: 'Error occurred during analysis',
  emptyStateLabel: 'No analysis generated yet',
} as const

// Performance thresholds
export const PERFORMANCE_CONFIG = {
  SLOW_REQUEST_MS: 5000,
  TIMEOUT_MS: 30000,
  DEBOUNCE_MS: 300,
} as const