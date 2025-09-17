'use client'

import { useEffect } from 'react'
import { errorTrackingService } from '@/lib/services/error-tracking.service'

export function GlobalErrorTracker() {
  useEffect(() => {
    // Initialize global error handlers
    errorTrackingService.initializeGlobalHandlers()
  }, [])

  return null
}