/**
 * Custom hook for AI Analysis functionality
 * Handles API calls, caching, error handling, and retry logic
 */

import { useState, useCallback } from "react"
import { 
  AnalysisResult, 
  AnalysisError, 
  AnalysisStatus, 
  AnalysisContext,
  UseAIAnalysisReturn,
  AIAnalysisTab
} from "@/types/ai-analysis"
import { AI_FEATURES_MAP, PERFORMANCE_CONFIG } from "@/lib/constants/ai-analysis"
import { 
  createAnalysisError, 
  withRetry, 
  validateAnalysisContext,
  shouldShowErrorToUser,
  createErrorSummary
} from "@/lib/utils/ai-analysis-errors"
import { aiAnalysisCache, createCacheKey } from "@/lib/utils/ai-analysis-cache"

interface UseAIAnalysisOptions {
  applicationId: string
  userId: string
  onSuccess?: (result: AnalysisResult) => void
  onError?: (error: AnalysisError) => void
}

export function useAIAnalysis({
  applicationId,
  userId,
  onSuccess,
  onError,
}: UseAIAnalysisOptions): UseAIAnalysisReturn {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState<AnalysisError | null>(null)

  const generateAnalysis = useCallback(async (
    analysisType: AIAnalysisTab,
    context: AnalysisContext
  ): Promise<void> => {
    // Validate context first
    const validationError = validateAnalysisContext({
      company: context.company,
      role: context.role,
      userId: context.userId,
      applicationId: context.applicationId,
    })

    if (validationError) {
      setError(validationError)
      setStatus('error')
      onError?.(validationError)
      return
    }

    // Check cache first
    const cacheKey = createCacheKey(applicationId, analysisType, userId)
    const cachedResult = aiAnalysisCache.get(cacheKey)
    
    if (cachedResult) {
      setAnalysis(cachedResult)
      setStatus('success')
      onSuccess?.(cachedResult)
      return
    }

    // Get feature configuration
    const featureConfig = AI_FEATURES_MAP.get(analysisType)
    if (!featureConfig) {
      const configError = createAnalysisError(
        new Error(`Unknown analysis type: ${analysisType}`),
        'Feature configuration'
      )
      setError(configError)
      setStatus('error')
      onError?.(configError)
      return
    }

    // Validate job description requirement
    if (featureConfig.requiresJobDescription && !context.jobDescription) {
      const jobDescError: AnalysisError = {
        type: 'validation',
        message: 'Job description is required for this analysis',
        details: 'Please add a job posting link to your application',
        retryable: false,
      }
      setError(jobDescError)
      setStatus('error')
      onError?.(jobDescError)
      return
    }

    setStatus('loading')
    setError(null)

    try {
      const result = await withRetry(async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          PERFORMANCE_CONFIG.TIMEOUT_MS
        )

        try {
          const response = await fetch(featureConfig.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(context),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw createAnalysisError(response, `Analysis API: ${analysisType}`)
          }

          const data = await response.json()
          
          // Validate response structure
          if (!data || typeof data !== 'object') {
            throw createAnalysisError(
              new Error('Invalid response format'),
              'API response validation'
            )
          }

          return data as AnalysisResult
        } catch (fetchError) {
          clearTimeout(timeoutId)
          throw fetchError
        }
      })

      // Cache the successful result
      aiAnalysisCache.set(cacheKey, result)

      setAnalysis(result)
      setStatus('success')
      onSuccess?.(result)

      // Log successful analysis
      console.info(`AI Analysis completed: ${analysisType}`, {
        applicationId,
        userId,
        timestamp: new Date().toISOString(),
      })

    } catch (analysisError) {
      const error = createAnalysisError(analysisError, `Analysis generation: ${analysisType}`)
      
      setError(error)
      setStatus('error')
      onError?.(error)

      // Log error for debugging
      console.error('AI Analysis failed:', createErrorSummary(error, analysisType))

      // Show user notification for certain error types
      if (shouldShowErrorToUser(error)) {
        // You could integrate with a toast notification system here
        console.warn('User should be notified of error:', error.message)
      }
    }
  }, [applicationId, userId, onSuccess, onError])

  const clearAnalysis = useCallback(() => {
    setAnalysis(null)
    setError(null)
    setStatus('idle')
  }, [])

  const clearCache = useCallback((analysisType?: AIAnalysisTab) => {
    if (analysisType) {
      const cacheKey = createCacheKey(applicationId, analysisType, userId)
      aiAnalysisCache.delete(cacheKey)
    } else {
      // Clear all cache entries for this application
      Object.values(['job-fit', 'interview', 'cover-letter'] as AIAnalysisTab[]).forEach(type => {
        const cacheKey = createCacheKey(applicationId, type, userId)
        aiAnalysisCache.delete(cacheKey)
      })
    }
  }, [applicationId, userId])

  const hasCachedResult = useCallback((analysisType: AIAnalysisTab): boolean => {
    const cacheKey = createCacheKey(applicationId, analysisType, userId)
    return aiAnalysisCache.has(cacheKey)
  }, [applicationId, userId])

  return {
    analysis,
    status,
    error,
    generateAnalysis,
    clearAnalysis,
    isLoading: status === 'loading',
    canRetry: error?.retryable ?? false,
    // Additional utilities
    clearCache,
    hasCachedResult,
  }
}