/**
 * Health Check Endpoint for Interview Prep System
 * 
 * Provides monitoring and health status for the interview preparation
 * transformation and caching system.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInterviewPrepMonitor, MonitoringUtils } from '@/lib/monitoring/interview-prep-monitor'

export async function GET(request: NextRequest) {
  try {
    const monitor = getInterviewPrepMonitor()
    
    // Get basic health check
    const healthCheck = MonitoringUtils.getHealthCheck()
    
    // Get detailed report if requested
    const url = new URL(request.url)
    const detailed = url.searchParams.get('detailed') === 'true'
    
    if (detailed) {
      const report = monitor.generateReport()
      
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
    console.error('Health check error:', error)
    
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
  try {
    const { action } = await request.json()
    const monitor = getInterviewPrepMonitor()
    
    switch (action) {
      case 'reset-metrics':
        monitor.resetMetrics()
        return NextResponse.json({
          success: true,
          message: 'Metrics reset successfully',
          timestamp: new Date().toISOString()
        })
        
      case 'export-metrics':
        const exportData = monitor.exportMetrics()
        return NextResponse.json({
          success: true,
          data: exportData
        })
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: reset-metrics, export-metrics' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Health check action error:', error)
    
    return NextResponse.json(
      {
        error: 'Action failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}