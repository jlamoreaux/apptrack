/**
 * Rate limiting utilities for AI Analysis endpoints
 * Prevents abuse and ensures fair usage of expensive AI operations
 */

import { NextRequest } from "next/server"

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  skipSuccessfulRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore: RateLimitStore = {}

// Periodic cleanup to prevent memory leaks
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    cleanupExpiredEntries()
  }, 5 * 60 * 1000) // Clean up every 5 minutes
}

// Default configurations for different AI endpoints
export const RATE_LIMIT_CONFIGS = {
  JOB_FIT_ANALYSIS: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  INTERVIEW_PREPARATION: {
    maxRequests: 3,
    windowMs: 60 * 1000, // 1 minute
  },
  COVER_LETTER: {
    maxRequests: 3,
    windowMs: 60 * 1000, // 1 minute
  },
} as const

/**
 * Rate limiting middleware for AI endpoints
 */
export async function checkRateLimit(
  request: NextRequest,
  userId: string,
  endpoint: keyof typeof RATE_LIMIT_CONFIGS
): Promise<{
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}> {
  const config = RATE_LIMIT_CONFIGS[endpoint]
  const key = `${endpoint}:${userId}`
  const now = Date.now()

  // Clean up expired entries periodically
  cleanupExpiredEntries()

  // Get or create rate limit entry
  let entry = rateLimitStore[key]
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
    rateLimitStore[key] = entry
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    }
  }

  // Increment counter
  entry.count++

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * IP-based rate limiting for additional protection
 */
export async function checkIPRateLimit(
  request: NextRequest,
  endpoint: string
): Promise<{
  allowed: boolean
  remaining: number
  resetTime: number
}> {
  const ip = getClientIP(request)
  const key = `ip:${endpoint}:${ip}`
  const now = Date.now()
  const windowMs = 5 * 60 * 1000 // 5 minutes
  const maxRequests = 20 // More generous for IP-based limiting

  let entry = rateLimitStore[key]
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    }
    rateLimitStore[key] = entry
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  entry.count++

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Extract client IP from request headers
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback to a default (should not happen in production)
  return 'unknown'
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  const keysToDelete: string[] = []

  for (const [key, entry] of Object.entries(rateLimitStore)) {
    if (now > entry.resetTime) {
      keysToDelete.push(key)
    }
  }

  for (const key of keysToDelete) {
    delete rateLimitStore[key]
  }
}

/**
 * Advanced rate limiting with burst protection
 */
export async function checkBurstRateLimit(
  userId: string,
  endpoint: keyof typeof RATE_LIMIT_CONFIGS
): Promise<{
  allowed: boolean
  burstRemaining: number
}> {
  const burstKey = `burst:${endpoint}:${userId}`
  const now = Date.now()
  const burstWindow = 10 * 1000 // 10 seconds
  const maxBurst = 2 // Max 2 requests in 10 seconds

  let entry = rateLimitStore[burstKey]
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + burstWindow,
    }
    rateLimitStore[burstKey] = entry
  }

  if (entry.count >= maxBurst) {
    return {
      allowed: false,
      burstRemaining: 0,
    }
  }

  entry.count++

  return {
    allowed: true,
    burstRemaining: maxBurst - entry.count,
  }
}

/**
 * Get rate limit status without incrementing counters
 */
export function getRateLimitStatus(
  userId: string,
  endpoint: keyof typeof RATE_LIMIT_CONFIGS
): {
  remaining: number
  resetTime: number
  isLimited: boolean
} {
  const config = RATE_LIMIT_CONFIGS[endpoint]
  const key = `${endpoint}:${userId}`
  const now = Date.now()

  const entry = rateLimitStore[key]
  if (!entry || now > entry.resetTime) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      isLimited: false,
    }
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
    isLimited: entry.count >= config.maxRequests,
  }
}

/**
 * Reset rate limit for a specific user and endpoint (admin function)
 */
export function resetRateLimit(
  userId: string,
  endpoint: keyof typeof RATE_LIMIT_CONFIGS
): void {
  const key = `${endpoint}:${userId}`
  delete rateLimitStore[key]
  
  const burstKey = `burst:${endpoint}:${userId}`
  delete rateLimitStore[burstKey]
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(
  remaining: number,
  resetTime: number,
  retryAfter?: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
  }

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString()
  }

  return headers
}