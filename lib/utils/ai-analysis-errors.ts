/**
 * Error handling utilities for AI Analysis features
 * Provides categorization, retry logic, and user-friendly error messages
 */

import { AnalysisError, ErrorType } from "@/types/ai-analysis"
import { ERROR_MESSAGES, RETRYABLE_ERRORS, RETRY_CONFIG } from "@/lib/constants/ai-analysis"

/**
 * Creates a standardized AnalysisError from various error sources
 */
export function createAnalysisError(
  error: unknown,
  context?: string
): AnalysisError {
  // Handle Response errors (fetch API)
  if (error instanceof Response) {
    return {
      type: getErrorTypeFromStatus(error.status),
      message: getErrorMessage(getErrorTypeFromStatus(error.status)),
      details: context ? `Context: ${context}` : undefined,
      retryable: RETRYABLE_ERRORS.has(getErrorTypeFromStatus(error.status)),
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    const errorType = categorizeError(error)
    return {
      type: errorType,
      message: getErrorMessage(errorType),
      details: `${error.message}${context ? ` | Context: ${context}` : ''}`,
      retryable: RETRYABLE_ERRORS.has(errorType),
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      message: getErrorMessage('unknown'),
      details: `${error}${context ? ` | Context: ${context}` : ''}`,
      retryable: false,
    }
  }

  // Fallback for unknown error types
  return {
    type: 'unknown',
    message: getErrorMessage('unknown'),
    details: context ? `Context: ${context}` : 'Unknown error occurred',
    retryable: false,
  }
}

/**
 * Categorizes errors based on their characteristics
 */
function categorizeError(error: Error): ErrorType {
  const message = error.message.toLowerCase()

  // Network errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    error.name === 'TypeError' && message.includes('failed to fetch')
  ) {
    return 'network'
  }

  // Authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('token') ||
    message.includes('auth')
  ) {
    return 'auth'
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('format')
  ) {
    return 'validation'
  }

  // Server errors (fallback)
  return 'server'
}

/**
 * Maps HTTP status codes to error types
 */
function getErrorTypeFromStatus(status: number): ErrorType {
  if (status >= 400 && status < 500) {
    if (status === 401 || status === 403) {
      return 'auth'
    }
    if (status === 400 || status === 422) {
      return 'validation'
    }
    return 'validation' // Other 4xx errors
  }

  if (status >= 500) {
    return 'server'
  }

  return 'unknown'
}

/**
 * Gets user-friendly error message for error type
 */
function getErrorMessage(type: ErrorType): string {
  return ERROR_MESSAGES[type]
}

/**
 * Implements exponential backoff retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = RETRY_CONFIG.MAX_ATTEMPTS,
  baseDelay: number = RETRY_CONFIG.BASE_DELAY_MS
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxAttempts) {
        break
      }

      const analysisError = createAnalysisError(error)
      if (!analysisError.retryable) {
        break
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, attempt - 1),
        RETRY_CONFIG.MAX_DELAY_MS
      )
      
      // Add jitter (±25% of delay)
      const jitter = delay * 0.25 * (Math.random() - 0.5)
      const finalDelay = Math.max(0, delay + jitter)

      await new Promise(resolve => setTimeout(resolve, finalDelay))
    }
  }

  throw lastError
}

/**
 * Validates analysis context before API calls
 */
export function validateAnalysisContext(context: {
  company: string
  role: string
  userId: string
  applicationId: string
}): AnalysisError | null {
  if (!context || typeof context !== 'object') {
    return {
      type: 'validation',
      message: 'Invalid context provided',
      details: 'Context must be an object',
      retryable: false,
    }
  }

  if (!context.company?.trim()) {
    return {
      type: 'validation',
      message: 'Company name is required',
      details: 'Missing or empty company field',
      retryable: false,
    }
  }

  if (!context.role?.trim()) {
    return {
      type: 'validation',
      message: 'Role title is required',
      details: 'Missing or empty role field',
      retryable: false,
    }
  }

  if (!context.userId?.trim()) {
    return {
      type: 'auth',
      message: 'User authentication required',
      details: 'Missing user ID',
      retryable: false,
    }
  }

  if (!context.applicationId?.trim()) {
    return {
      type: 'validation',
      message: 'Application ID is required',
      details: 'Missing application ID',
      retryable: false,
    }
  }

  return null
}

/**
 * Determines if an error should trigger a user notification
 */
export function shouldShowErrorToUser(error: AnalysisError): boolean {
  // Always show validation and auth errors to user
  if (error.type === 'validation' || error.type === 'auth') {
    return true
  }

  // Show network errors if not retryable
  if (error.type === 'network' && !error.retryable) {
    return true
  }

  // Show server errors after retries are exhausted
  if (error.type === 'server') {
    return true
  }

  return false
}

/**
 * Creates a user-friendly error summary for logging
 */
export function createErrorSummary(error: AnalysisError, context?: string): string {
  const parts = [
    `Type: ${error.type}`,
    `Message: ${error.message}`,
    `Retryable: ${error.retryable}`,
  ]

  if (error.details) {
    parts.push(`Details: ${error.details}`)
  }

  if (context) {
    parts.push(`Context: ${context}`)
  }

  return parts.join(' | ')
}