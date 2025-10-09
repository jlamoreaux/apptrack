/**
 * Health Check Endpoint for Interview Prep System
 * 
 * Provides monitoring and health status for the interview preparation
 * transformation and caching system.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInterviewPrepMonitor, MonitoringUtils } from '@/lib/monitoring/interview-prep-monitor'
import { loggerService } from '@/lib/services/logger.service'
import { LogCategory } from '@/lib/services/logger.types'

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const monitor = getInterviewPrepMonitor()
    
    // Get basic health check
    const healthCheck = MonitoringUtils.getHealthCheck()
    
    // Get detailed report if requested
    const url = new URL(request.url)
    const detailed = url.searchParams.get('detailed') === 'true'
    
    if (detailed) {
      const report = monitor.generateReport()
      
      loggerService.info('Interview prep health check detailed report generated', {
        category: LogCategory.BUSINESS,
        action: 'health_interview_prep_detailed',
        duration: Date.now() - startTime,
        metadata: {
          status: healthCheck.status,
          alertCount: report.alerts.length,
          totalRequests: healthCheck.metrics.totalRequests
        }
      });
      
      return NextResponse.json({
        status: healthCheck.status,
        timestamp: new Date().toISOString(),
        system: 'interview-prep-transformer',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        health: {
          metrics: healthCheck.metrics,
          alerts: report.alerts,
          recommendations: report.recommendations,
          eventSummary: report.eventSummary
        },
        cache: {
          stats: monitor.getCacheStats(),
          enabled: true
        }
      })
    }
    
    // Basic health check response
    loggerService.info('Interview prep health check completed', {
      category: LogCategory.BUSINESS,
      action: 'health_interview_prep_basic',
      duration: Date.now() - startTime,
      metadata: {
        status: healthCheck.status,
        errorRate: healthCheck.metrics.errorRate,
        cacheHitRate: healthCheck.metrics.cacheHitRate
      }
    });
    
    return NextResponse.json({
      status: healthCheck.status,
      timestamp: new Date().toISOString(),
      system: 'interview-prep-transformer',
      metrics: {
        totalRequests: healthCheck.metrics.totalRequests,
        errorRate: healthCheck.metrics.errorRate,
        averageResponseTime: healthCheck.metrics.averageResponseTime,
        cacheHitRate: healthCheck.metrics.cacheHitRate
      }
    })
    
  } catch (error) {
    loggerService.error('Health check error', error, {
      category: LogCategory.API,
      action: 'health_interview_prep_error',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        system: 'interview-prep-transformer',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { action } = await request.json()
    const monitor = getInterviewPrepMonitor()
    
    switch (action) {
      case 'reset-metrics':
        monitor.resetMetrics()
        
        loggerService.info('Interview prep metrics reset', {
          category: LogCategory.BUSINESS,
          action: 'health_interview_prep_reset',
          duration: Date.now() - startTime
        });
        
        return NextResponse.json({
          success: true,
          message: 'Metrics reset successfully',
          timestamp: new Date().toISOString()
        })
        
      case 'export-metrics':
        const exportData = monitor.exportMetrics()
        
        loggerService.info('Interview prep metrics exported', {
          category: LogCategory.BUSINESS,
          action: 'health_interview_prep_export',
          duration: Date.now() - startTime,
          metadata: {
            exportedMetricsCount: Object.keys(exportData).length
          }
        });
        
        return NextResponse.json({
          success: true,
          data: exportData
        })
        
      default:
        loggerService.warn('Invalid health check action', {
          category: LogCategory.API,
          action: 'health_interview_prep_invalid_action',
          duration: Date.now() - startTime,
          metadata: { providedAction: action }
        });
        
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: reset-metrics, export-metrics' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    loggerService.error('Health check action error', error, {
      category: LogCategory.API,
      action: 'health_interview_prep_action_error',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      {
        error: 'Action failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}