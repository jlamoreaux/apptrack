/**
 * Caching utilities for AI Analysis results
 * Provides efficient storage and retrieval of analysis results
 */

import { AnalysisResult, AnalysisCache, AIAnalysisTab } from "@/types/ai-analysis"
import { CACHE_CONFIG } from "@/lib/constants/ai-analysis"

/**
 * Creates a cache key for an analysis request
 */
export function createCacheKey(
  applicationId: string,
  analysisType: AIAnalysisTab,
  userId: string
): string {
  return `${userId}:${applicationId}:${analysisType}`
}

/**
 * In-memory cache implementation
 */
class AnalysisCacheManager {
  private cache: Map<string, AnalysisCache[string]> = new Map()
  private maxSize: number = CACHE_CONFIG.MAX_ENTRIES
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start periodic cleanup every 5 minutes
    this.startPeriodicCleanup()
  }

  /**
   * Starts periodic cleanup to prevent memory leaks
   */
  private startPeriodicCleanup(): void {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => {
        this.cleanExpired()
        // If cache is still too large after cleanup, remove oldest entries
        if (this.cache.size > this.maxSize * 0.8) {
          this.evictOldest(Math.floor(this.maxSize * 0.2))
        }
      }, 5 * 60 * 1000) // 5 minutes
    }
  }

  /**
   * Stops periodic cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Evicts oldest entries to prevent unbounded growth
   */
  private evictOldest(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count)
    
    entries.forEach(([key]) => this.cache.delete(key))
  }

  /**
   * Stores analysis result in cache
   */
  set(key: string, result: AnalysisResult): void {
    // Clean expired entries before adding new one
    this.cleanExpired()

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    const now = Date.now()
    this.cache.set(key, {
      result,
      timestamp: now,
      expiresAt: now + CACHE_CONFIG.EXPIRATION_MS,
    })
  }

  /**
   * Retrieves analysis result from cache
   */
  get(key: string): AnalysisResult | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.result
  }

  /**
   * Checks if a cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Removes a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy(): void {
    this.stopPeriodicCleanup()
    this.cache.clear()
  }

  /**
   * Removes expired entries from cache
   */
  private cleanExpired(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key))
  }

  /**
   * Gets cache statistics for debugging
   */
  getStats() {
    this.cleanExpired()
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        expiresAt: entry.expiresAt,
        expired: Date.now() > entry.expiresAt,
      })),
    }
  }
}

// Singleton cache instance
export const analysisCache = new AnalysisCacheManager()

/**
 * Local storage cache implementation for persistence across sessions
 */
class PersistentCacheManager {
  private storageKey = CACHE_CONFIG.STORAGE_KEY

  /**
   * Stores analysis result in localStorage
   */
  set(key: string, result: AnalysisResult): void {
    try {
      const cache = this.getStorageCache()
      const now = Date.now()
      
      cache[key] = {
        result,
        timestamp: now,
        expiresAt: now + CACHE_CONFIG.EXPIRATION_MS,
      }

      // Clean expired entries
      this.cleanExpired(cache)

      // Limit cache size
      const entries = Object.entries(cache)
      if (entries.length > CACHE_CONFIG.MAX_ENTRIES) {
        // Remove oldest entries
        entries
          .sort(([, a], [, b]) => a.timestamp - b.timestamp)
          .slice(0, entries.length - CACHE_CONFIG.MAX_ENTRIES)
          .forEach(([expiredKey]) => delete cache[expiredKey])
      }

      localStorage.setItem(this.storageKey, JSON.stringify(cache))
    } catch (error) {
    }
  }

  /**
   * Retrieves analysis result from localStorage
   */
  get(key: string): AnalysisResult | null {
    try {
      const cache = this.getStorageCache()
      const entry = cache[key]

      if (!entry) {
        return null
      }

      // Check if entry has expired
      if (Date.now() > entry.expiresAt) {
        delete cache[key]
        localStorage.setItem(this.storageKey, JSON.stringify(cache))
        return null
      }

      return entry.result
    } catch (error) {
      return null
    }
  }

  /**
   * Checks if a cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Removes a specific cache entry
   */
  delete(key: string): boolean {
    try {
      const cache = this.getStorageCache()
      const existed = key in cache
      delete cache[key]
      localStorage.setItem(this.storageKey, JSON.stringify(cache))
      return existed
    } catch (error) {
      return false
    }
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    try {
      localStorage.removeItem(this.storageKey)
    } catch (error) {
    }
  }

  /**
   * Gets cache from localStorage
   */
  private getStorageCache(): AnalysisCache {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      localStorage.removeItem(this.storageKey)
      return {}
    }
  }

  /**
   * Removes expired entries from cache object
   */
  private cleanExpired(cache: AnalysisCache): void {
    const now = Date.now()
    Object.keys(cache).forEach(key => {
      if (now > cache[key].expiresAt) {
        delete cache[key]
      }
    })
  }
}

// Singleton persistent cache instance
export const persistentCache = new PersistentCacheManager()

/**
 * Hybrid cache that uses both memory and localStorage
 */
export class HybridCache {
  /**
   * Stores result in both memory and persistent storage
   */
  set(key: string, result: AnalysisResult): void {
    analysisCache.set(key, result)
    persistentCache.set(key, result)
  }

  /**
   * Retrieves result, preferring memory cache for speed
   */
  get(key: string): AnalysisResult | null {
    // Try memory cache first (faster)
    let result = analysisCache.get(key)
    if (result) {
      return result
    }

    // Fall back to persistent cache
    result = persistentCache.get(key)
    if (result) {
      // Warm up memory cache
      analysisCache.set(key, result)
      return result
    }

    return null
  }

  /**
   * Checks if entry exists in either cache
   */
  has(key: string): boolean {
    return analysisCache.has(key) || persistentCache.has(key)
  }

  /**
   * Removes entry from both caches
   */
  delete(key: string): boolean {
    const memoryDeleted = analysisCache.delete(key)
    const persistentDeleted = persistentCache.delete(key)
    return memoryDeleted || persistentDeleted
  }

  /**
   * Clears both caches
   */
  clear(): void {
    analysisCache.clear()
    persistentCache.clear()
  }
}

// Main cache instance for use throughout the application
export const aiAnalysisCache = new HybridCache()