/**
 * Performance Utilities for Interview Prep System
 * 
 * Provides utilities for performance measurement, optimization,
 * and monitoring across the interview preparation system.
 */

// Import monitoring if available, fallback to console logging
let getInterviewPrepMonitor: (() => { recordEvent: (event: string, data: any) => void }) | null = null;

try {
  const monitoringModule = require('@/lib/monitoring/interview-prep-monitor');
  getInterviewPrepMonitor = monitoringModule.getInterviewPrepMonitor;
} catch {
  // Monitoring not available, use fallback
  getInterviewPrepMonitor = () => ({
    recordEvent: (event: string, data: any) => {
      console.log(`[Performance] ${event}:`, data);
    }
  });
}

// Performance measurement utilities
export class PerformanceTimer {
  private startTime: number
  private marks: Map<string, number> = new Map()

  constructor() {
    this.startTime = performance.now()
  }

  /**
   * Add a performance mark
   */
  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  /**
   * Get elapsed time since timer start
   */
  getElapsed(): number {
    return performance.now() - this.startTime
  }

  /**
   * Get time between two marks
   */
  getMarkDuration(startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark)
    if (!start) throw new Error(`Mark '${startMark}' not found`)

    const end = endMark ? this.marks.get(endMark) : performance.now()
    if (endMark && !end) throw new Error(`Mark '${endMark}' not found`)

    return (end || performance.now()) - start
  }

  /**
   * Get all marks with durations
   */
  getAllMarks(): Record<string, number> {
    const results: Record<string, number> = {}
    // Use Array.from to avoid iterator compatibility issues
    Array.from(this.marks.entries()).forEach(([name, time]) => {
      results[name] = time - this.startTime
    })
    return results
  }
}

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
  private initialMemory: NodeJS.MemoryUsage

  constructor() {
    this.initialMemory = process.memoryUsage()
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage()
  }

  /**
   * Get memory difference since initialization
   */
  getMemoryDelta(): {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  } {
    const current = process.memoryUsage()
    return {
      rss: current.rss - this.initialMemory.rss,
      heapUsed: current.heapUsed - this.initialMemory.heapUsed,
      heapTotal: current.heapTotal - this.initialMemory.heapTotal,
      external: current.external - this.initialMemory.external
    }
  }

  /**
   * Format memory usage for human reading
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}

/**
 * Performance profiler for interview prep operations
 */
export class InterviewPrepProfiler {
  private timer: PerformanceTimer
  private memoryMonitor: MemoryMonitor

  constructor() {
    this.timer = new PerformanceTimer()
    this.memoryMonitor = new MemoryMonitor()
  }

  /**
   * Profile a transformation operation
   */
  async profileTransformation<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{
    result: T
    performance: {
      duration: number
      memoryDelta: ReturnType<MemoryMonitor['getMemoryDelta']>
      marks: Record<string, number>
    }
  }> {
    this.timer.mark('start')
    
    const result = await operation()
    
    this.timer.mark('end')
    
    const performance = {
      duration: this.timer.getElapsed(),
      memoryDelta: this.memoryMonitor.getMemoryDelta(),
      marks: this.timer.getAllMarks()
    }

    // Log performance data if monitoring is enabled
    const monitor = getInterviewPrepMonitor?.()
    monitor?.recordEvent('transformation_profiled', {
      duration: performance.duration,
      memoryUsed: performance.memoryDelta.heapUsed,
      ...metadata
    })

    return { result, performance }
  }

  /**
   * Profile cache operations
   */
  profileCacheOperation<T>(
    operation: () => T,
    operationType: 'hit' | 'miss' | 'set' | 'evict'
  ): {
    result: T
    duration: number
  } {
    const start = performance.now()
    const result = operation()
    const duration = performance.now() - start

    const monitor = getInterviewPrepMonitor?.()
    monitor?.recordEvent('cache_operation_profiled', {
      operationType,
      duration
    })

    return { result, duration }
  }
}

/**
 * Batch performance analyzer
 */
export class BatchPerformanceAnalyzer {
  private operations: Array<{
    name: string
    duration: number
    memoryUsage: number
    timestamp: number
  }> = []

  /**
   * Add operation result
   */
  addOperation(
    name: string,
    duration: number,
    memoryUsage: number = 0
  ): void {
    this.operations.push({
      name,
      duration,
      memoryUsage,
      timestamp: Date.now()
    })
  }

  /**
   * Analyze batch results
   */
  analyze(): {
    totalOperations: number
    totalDuration: number
    averageDuration: number
    slowestOperation: { name: string; duration: number } | null
    fastestOperation: { name: string; duration: number } | null
    memoryTrend: 'increasing' | 'decreasing' | 'stable'
    recommendations: string[]
  } {
    if (this.operations.length === 0) {
      return {
        totalOperations: 0,
        totalDuration: 0,
        averageDuration: 0,
        slowestOperation: null,
        fastestOperation: null,
        memoryTrend: 'stable',
        recommendations: []
      }
    }

    const totalDuration = this.operations.reduce((sum, op) => sum + op.duration, 0)
    const averageDuration = totalDuration / this.operations.length

    const sortedByDuration = [...this.operations].sort((a, b) => a.duration - b.duration)
    const slowestOperation = sortedByDuration[sortedByDuration.length - 1]
    const fastestOperation = sortedByDuration[0]

    // Analyze memory trend
    let memoryTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (this.operations.length > 1) {
      const firstHalf = this.operations.slice(0, Math.floor(this.operations.length / 2))
      const secondHalf = this.operations.slice(Math.floor(this.operations.length / 2))
      
      const firstHalfAvg = firstHalf.reduce((sum, op) => sum + op.memoryUsage, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((sum, op) => sum + op.memoryUsage, 0) / secondHalf.length
      
      if (secondHalfAvg > firstHalfAvg * 1.1) {
        memoryTrend = 'increasing'
      } else if (secondHalfAvg < firstHalfAvg * 0.9) {
        memoryTrend = 'decreasing'
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    
    if (averageDuration > 1000) {
      recommendations.push('Average operation time is high - consider optimization')
    }
    
    if (slowestOperation.duration > averageDuration * 3) {
      recommendations.push(`Operation '${slowestOperation.name}' is significantly slower than average`)
    }
    
    if (memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing - check for memory leaks')
    }
    
    const varianceThreshold = averageDuration * 0.5
    const highVarianceOps = this.operations.filter(
      op => Math.abs(op.duration - averageDuration) > varianceThreshold
    )
    
    if (highVarianceOps.length > this.operations.length * 0.3) {
      recommendations.push('High performance variance detected - investigate inconsistent operations')
    }

    return {
      totalOperations: this.operations.length,
      totalDuration,
      averageDuration,
      slowestOperation: {
        name: slowestOperation.name,
        duration: slowestOperation.duration
      },
      fastestOperation: {
        name: fastestOperation.name,
        duration: fastestOperation.duration
      },
      memoryTrend,
      recommendations
    }
  }

  /**
   * Reset analyzer
   */
  reset(): void {
    this.operations = []
  }

  /**
   * Export data for external analysis
   */
  exportData(): typeof this.operations {
    return [...this.operations]
  }
}

/**
 * System resource monitor
 */
export class SystemResourceMonitor {
  /**
   * Get current system load indicators
   */
  static getSystemLoad(): {
    cpuUsage: NodeJS.CpuUsage | null
    memoryUsage: NodeJS.MemoryUsage
    uptime: number
    loadAverage: number[]
  } {
    return {
      cpuUsage: process.cpuUsage ? process.cpuUsage() : null,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : []
    }
  }

  /**
   * Check if system is under high load
   */
  static isSystemUnderLoad(): {
    isHighLoad: boolean
    reasons: string[]
    recommendations: string[]
  } {
    const load = this.getSystemLoad()
    const reasons: string[] = []
    const recommendations: string[] = []

    // Check memory usage (> 80% of heap)
    const heapUsagePercent = (load.memoryUsage.heapUsed / load.memoryUsage.heapTotal) * 100
    if (heapUsagePercent > 80) {
      reasons.push(`High heap usage: ${heapUsagePercent.toFixed(1)}%`)
      recommendations.push('Consider memory optimization or garbage collection')
    }

    // Check RSS memory (> 1GB on most systems)
    if (load.memoryUsage.rss > 1024 * 1024 * 1024) {
      reasons.push(`High RSS memory: ${MemoryMonitor.formatBytes(load.memoryUsage.rss)}`)
      recommendations.push('Monitor for memory leaks')
    }

    // Check load average (Unix systems only)
    if (load.loadAverage.length > 0 && load.loadAverage[0] > 2) {
      reasons.push(`High system load: ${load.loadAverage[0].toFixed(2)}`)
      recommendations.push('System is under high load - consider scaling')
    }

    return {
      isHighLoad: reasons.length > 0,
      reasons,
      recommendations
    }
  }
}

/**
 * Utility functions for performance monitoring
 */
export const PerformanceUtils = {
  /**
   * Create a performance timer
   */
  createTimer: (): PerformanceTimer => new PerformanceTimer(),

  /**
   * Create a memory monitor
   */
  createMemoryMonitor: (): MemoryMonitor => new MemoryMonitor(),

  /**
   * Create a profiler
   */
  createProfiler: (): InterviewPrepProfiler => new InterviewPrepProfiler(),

  /**
   * Create a batch analyzer
   */
  createBatchAnalyzer: (): BatchPerformanceAnalyzer => new BatchPerformanceAnalyzer(),

  /**
   * Quick performance measurement
   */
  measure: async <T>(
    operation: () => Promise<T>,
    name?: string
  ): Promise<{ result: T; duration: number }> => {
    const start = performance.now()
    const result = await operation()
    const duration = performance.now() - start

    if (name) {
      const monitor = getInterviewPrepMonitor?.()
      monitor?.recordEvent('operation_measured', { name, duration })
    }

    return { result, duration }
  },

  /**
   * Memory-safe operation wrapper
   */
  withMemoryCheck: async <T>(
    operation: () => Promise<T>,
    maxMemoryMB: number = 500
  ): Promise<T> => {
    const memoryMonitor = new MemoryMonitor()
    
    const result = await operation()
    
    const memoryDelta = memoryMonitor.getMemoryDelta()
    const memoryUsedMB = memoryDelta.heapUsed / (1024 * 1024)
    
    if (memoryUsedMB > maxMemoryMB) {
      console.warn(`Operation used ${memoryUsedMB.toFixed(2)}MB, exceeding limit of ${maxMemoryMB}MB`)
      
      const monitor = getInterviewPrepMonitor?.()
      monitor?.recordEvent('high_memory_usage', {
        memoryUsedMB,
        maxMemoryMB,
        exceeded: true
      })
    }
    
    return result
  },

  /**
   * Get formatted system status
   */
  getSystemStatus: (): {
    performance: string
    memory: string
    recommendations: string[]
  } => {
    const systemLoad = SystemResourceMonitor.getSystemLoad()
    const loadCheck = SystemResourceMonitor.isSystemUnderLoad()
    
    const heapUsagePercent = (systemLoad.memoryUsage.heapUsed / systemLoad.memoryUsage.heapTotal) * 100
    
    return {
      performance: loadCheck.isHighLoad ? 'degraded' : 'good',
      memory: `${heapUsagePercent.toFixed(1)}% heap, ${MemoryMonitor.formatBytes(systemLoad.memoryUsage.rss)} RSS`,
      recommendations: loadCheck.recommendations
    }
  }
}