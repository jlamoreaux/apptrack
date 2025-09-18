/**
 * Interview Prep Performance Monitoring and Logging
 * 
 * Provides comprehensive monitoring, metrics collection, and alerting
 * for the interview preparation system.
 */

import { getEnvironmentConfig } from '@/lib/config/interview-prep'

// Monitoring event types
export type MonitoringEvent = 
  | 'transformation_started'
  | 'transformation_completed'
  | 'transformation_failed'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_eviction'
  | 'validation_failed'
  | 'parsing_error'
  | 'context_extraction_failed'
  | 'slow_operation'
  | 'error_recovered'

// Monitoring data structures
export interface MonitoringMetric {
  timestamp: number
  event: MonitoringEvent
  duration?: number
  metadata?: Record<string, any>
  userId?: string
  requestId?: string
  error?: string
}

export interface PerformanceMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  cacheHitRate: number
  errorRate: number
  slowOperations: number
  lastReset: number
}

export interface AlertThresholds {
  maxResponseTime: number
  minCacheHitRate: number
  maxErrorRate: number
  maxConsecutiveFailures: number
}

/**
 * Main monitoring service for interview preparation functionality
 */
export class InterviewPrepMonitor {
  private metrics: MonitoringMetric[] = []
  private config = getEnvironmentConfig()
  private consecutiveFailures = 0
  private lastMetricsReset = Date.now()
  
  // Default alert thresholds
  private alertThresholds: AlertThresholds = {
    maxResponseTime: 5000, // 5 seconds
    minCacheHitRate: 0.3,  // 30%
    maxErrorRate: 0.1,     // 10%
    maxConsecutiveFailures: 5
  }

  // Metrics aggregation cache
  private cachedMetrics: PerformanceMetrics | null = null
  private metricsCache = {
    timestamp: 0,
    ttl: 60000 // 1 minute
  }

  /**
   * Record a monitoring event
   */
  recordEvent(
    event: MonitoringEvent,
    metadata?: Record<string, any>,
    userId?: string,
    requestId?: string
  ): void {
    if (!this.config.FEATURES.ENABLE_PERFORMANCE_MONITORING) {
      return
    }

    const metric: MonitoringMetric = {
      timestamp: Date.now(),
      event,
      metadata,
      userId,
      requestId
    }

    this.metrics.push(metric)
    
    // Handle special events
    this.handleSpecialEvents(event, metadata)
    
    // Cleanup old metrics periodically
    this.cleanupOldMetrics()
    
    // Log important events
    this.logEvent(metric)
  }

  /**
   * Record a timed operation
   */
  recordTimedOperation<T>(
    operation: () => Promise<T>,
    event: MonitoringEvent,
    metadata?: Record<string, any>,
    userId?: string,
    requestId?: string
  ): Promise<T> {
    const startTime = Date.now()
    
    this.recordEvent(`${event}_started` as MonitoringEvent, metadata, userId, requestId)
    
    return operation()
      .then(result => {
        const duration = Date.now() - startTime
        
        this.recordEvent(
          `${event}_completed` as MonitoringEvent,
          { ...metadata, duration },
          userId,
          requestId
        )
        
        // Check for slow operations
        if (duration > this.alertThresholds.maxResponseTime) {
          this.recordEvent(
            'slow_operation',
            { ...metadata, duration, originalEvent: event },
            userId,
            requestId
          )
        }
        
        this.consecutiveFailures = 0
        return result
      })
      .catch(error => {
        const duration = Date.now() - startTime
        
        this.recordEvent(
          `${event}_failed` as MonitoringEvent,
          { ...metadata, duration, error: error.message },
          userId,
          requestId
        )
        
        this.consecutiveFailures++
        this.checkAlerts()
        
        throw error
      })
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now()
    
    // Return cached metrics if still valid
    if (this.cachedMetrics && 
        now - this.metricsCache.timestamp < this.metricsCache.ttl) {
      return this.cachedMetrics
    }

    const recentMetrics = this.getRecentMetrics()
    
    const totalRequests = recentMetrics.filter(
      m => m.event.includes('transformation_started')
    ).length

    const successfulRequests = recentMetrics.filter(
      m => m.event.includes('transformation_completed')
    ).length

    const failedRequests = recentMetrics.filter(
      m => m.event.includes('transformation_failed')
    ).length

    const cacheHits = recentMetrics.filter(m => m.event === 'cache_hit').length
    const cacheMisses = recentMetrics.filter(m => m.event === 'cache_miss').length
    const totalCacheRequests = cacheHits + cacheMisses

    const responseTimes = recentMetrics
      .filter(m => m.event.includes('completed') && m.metadata?.duration)
      .map(m => m.metadata!.duration as number)

    const slowOperations = recentMetrics.filter(
      m => m.event === 'slow_operation'
    ).length

    const metrics: PerformanceMetrics = {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0,
      cacheHitRate: totalCacheRequests > 0 
        ? cacheHits / totalCacheRequests 
        : 0,
      errorRate: totalRequests > 0 
        ? failedRequests / totalRequests 
        : 0,
      slowOperations,
      lastReset: this.lastMetricsReset
    }

    // Cache the computed metrics
    this.cachedMetrics = metrics
    this.metricsCache.timestamp = now

    return metrics
  }

  /**
   * Get detailed event history
   */
  getEventHistory(
    limit: number = 100,
    eventType?: MonitoringEvent
  ): MonitoringMetric[] {
    let events = this.getRecentMetrics()
    
    if (eventType) {
      events = events.filter(m => m.event === eventType)
    }
    
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Generate monitoring report
   */
  generateReport(): {
    summary: PerformanceMetrics
    alerts: string[]
    recommendations: string[]
    eventSummary: Record<MonitoringEvent, number>
  } {
    const metrics = this.getMetrics()
    const alerts: string[] = []
    const recommendations: string[] = []
    
    // Check alert conditions
    if (metrics.averageResponseTime > this.alertThresholds.maxResponseTime) {
      alerts.push(`High average response time: ${metrics.averageResponseTime}ms`)
      recommendations.push('Consider optimizing parsing algorithms or adding more caching')
    }
    
    if (metrics.cacheHitRate < this.alertThresholds.minCacheHitRate && metrics.totalRequests > 10) {
      alerts.push(`Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)
      recommendations.push('Review caching strategy and consider increasing cache size')
    }
    
    if (metrics.errorRate > this.alertThresholds.maxErrorRate && metrics.totalRequests > 5) {
      alerts.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`)
      recommendations.push('Investigate error patterns and improve error handling')
    }
    
    if (this.consecutiveFailures >= this.alertThresholds.maxConsecutiveFailures) {
      alerts.push(`${this.consecutiveFailures} consecutive failures detected`)
      recommendations.push('Check system health and consider circuit breaker pattern')
    }

    // Performance recommendations
    if (metrics.slowOperations > metrics.totalRequests * 0.2) {
      recommendations.push('High number of slow operations - consider performance optimization')
    }

    if (metrics.totalRequests > 100 && metrics.cacheHitRate > 0.8) {
      recommendations.push('Excellent cache performance - consider current settings as baseline')
    }

    // Event summary
    const recentMetrics = this.getRecentMetrics()
    const eventSummary = recentMetrics.reduce((summary, metric) => {
      summary[metric.event] = (summary[metric.event] || 0) + 1
      return summary
    }, {} as Record<MonitoringEvent, number>)

    return {
      summary: metrics,
      alerts,
      recommendations,
      eventSummary
    }
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics(): void {
    this.metrics = []
    this.consecutiveFailures = 0
    this.lastMetricsReset = Date.now()
    this.cachedMetrics = null
    this.metricsCache.timestamp = 0
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: number
    environment: string
    metrics: PerformanceMetrics
    events: MonitoringMetric[]
  } {
    return {
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'unknown',
      metrics: this.getMetrics(),
      events: this.getRecentMetrics()
    }
  }

  /**
   * Handle special monitoring events
   */
  private handleSpecialEvents(
    event: MonitoringEvent,
    metadata?: Record<string, any>
  ): void {
    switch (event) {
      case 'cache_hit':
      case 'cache_miss':
        // Invalidate cached metrics when cache events occur
        this.cachedMetrics = null
        break
        
      case 'transformation_failed':
        this.consecutiveFailures++
        break
        
      case 'transformation_completed':
        this.consecutiveFailures = 0
        break
        
      case 'slow_operation':
        if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
            event,
            duration: metadata?.duration,
            threshold: this.alertThresholds.maxResponseTime
          })
        }
        break
    }
  }

  /**
   * Check alert conditions and log if necessary
   */
  private checkAlerts(): void {
    if (this.consecutiveFailures >= this.alertThresholds.maxConsecutiveFailures) {
    }
    
    const metrics = this.getMetrics()
    if (metrics.errorRate > this.alertThresholds.maxErrorRate && metrics.totalRequests > 5) {
    }
  }

  /**
   * Log important events
   */
  private logEvent(metric: MonitoringMetric): void {
    if (!this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      return
    }

    const logLevel = this.getLogLevel(metric.event)
    const message = this.formatLogMessage(metric)

    switch (logLevel) {
      case 'error':
        break
      case 'warn':
        break
      case 'info':
        break
      case 'debug':
        break
    }
  }

  /**
   * Determine log level for event
   */
  private getLogLevel(event: MonitoringEvent): 'error' | 'warn' | 'info' | 'debug' {
    const errorEvents = ['transformation_failed', 'parsing_error', 'context_extraction_failed']
    const warnEvents = ['slow_operation', 'validation_failed', 'cache_eviction']
    const infoEvents = ['transformation_completed', 'cache_hit', 'cache_miss']
    
    if (errorEvents.includes(event)) return 'error'
    if (warnEvents.includes(event)) return 'warn'
    if (infoEvents.includes(event)) return 'info'
    return 'debug'
  }

  /**
   * Format log message
   */
  private formatLogMessage(metric: MonitoringMetric): string {
    const parts = [
      `[InterviewPrep]`,
      `Event: ${metric.event}`,
      metric.requestId ? `RequestID: ${metric.requestId}` : null,
      metric.userId ? `UserID: ${metric.userId}` : null,
      metric.metadata?.duration ? `Duration: ${metric.metadata.duration}ms` : null,
      metric.error ? `Error: ${metric.error}` : null
    ].filter(Boolean)

    return parts.join(' | ')
  }

  /**
   * Get recent metrics (last hour)
   */
  private getRecentMetrics(): MonitoringMetric[] {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    return this.metrics.filter(m => m.timestamp > oneHourAgo)
  }

  /**
   * Clean up old metrics to prevent memory bloat
   */
  private cleanupOldMetrics(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo)
  }
}

// Global monitor instance
let globalMonitor: InterviewPrepMonitor | null = null

/**
 * Get or create global monitor instance
 */
export function getInterviewPrepMonitor(): InterviewPrepMonitor {
  if (!globalMonitor) {
    globalMonitor = new InterviewPrepMonitor()
  }
  return globalMonitor
}

/**
 * Utility functions for easy monitoring integration
 */
export const MonitoringUtils = {
  /**
   * Record a transformation operation
   */
  recordTransformation: async <T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>,
    userId?: string,
    requestId?: string
  ): Promise<T> => {
    const monitor = getInterviewPrepMonitor()
    return monitor.recordTimedOperation(
      operation,
      'transformation_completed',
      metadata,
      userId,
      requestId
    )
  },

  /**
   * Record cache operations
   */
  recordCacheHit: (metadata?: Record<string, any>) => {
    const monitor = getInterviewPrepMonitor()
    monitor.recordEvent('cache_hit', metadata)
  },

  recordCacheMiss: (metadata?: Record<string, any>) => {
    const monitor = getInterviewPrepMonitor()
    monitor.recordEvent('cache_miss', metadata)
  },

  /**
   * Record validation failures
   */
  recordValidationFailure: (metadata?: Record<string, any>) => {
    const monitor = getInterviewPrepMonitor()
    monitor.recordEvent('validation_failed', metadata)
  },

  /**
   * Record parsing errors
   */
  recordParsingError: (error: string, metadata?: Record<string, any>) => {
    const monitor = getInterviewPrepMonitor()
    monitor.recordEvent('parsing_error', { error, ...metadata })
  },

  /**
   * Get current metrics for API responses
   */
  getCurrentMetrics: (): PerformanceMetrics => {
    const monitor = getInterviewPrepMonitor()
    return monitor.getMetrics()
  },

  /**
   * Generate health check response
   */
  getHealthCheck: (): { status: 'healthy' | 'degraded' | 'unhealthy'; metrics: PerformanceMetrics } => {
    const monitor = getInterviewPrepMonitor()
    const metrics = monitor.getMetrics()
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (metrics.errorRate > 0.5 || metrics.averageResponseTime > 10000) {
      status = 'unhealthy'
    } else if (metrics.errorRate > 0.1 || metrics.averageResponseTime > 5000) {
      status = 'degraded'
    }
    
    return { status, metrics }
  }
}