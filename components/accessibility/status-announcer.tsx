/**
 * Status Announcer Component for Screen Reader Accessibility
 * 
 * Provides announcements for dynamic content changes using aria-live regions.
 * Supports different politeness levels and maintains a queue of announcements.
 */

import { useEffect, useRef, useState } from 'react'

export type PolitenessLevel = 'polite' | 'assertive' | 'off'

interface StatusAnnouncerProps {
  message?: string
  politeness?: PolitenessLevel
  clearOnUnmount?: boolean
  className?: string
}

/**
 * Individual Status Announcer Component
 */
export function StatusAnnouncer({ 
  message, 
  politeness = 'polite', 
  clearOnUnmount = true,
  className = ''
}: StatusAnnouncerProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      className={`sr-only ${className}`}
      role={politeness === 'assertive' ? 'alert' : 'status'}
    >
      {message}
    </div>
  )
}

/**
 * Global Status Manager for Coordinated Announcements
 */
class StatusManager {
  private politeRef: HTMLDivElement | null = null
  private assertiveRef: HTMLDivElement | null = null
  private queue: Array<{ message: string; politeness: PolitenessLevel; timestamp: number }> = []
  private isProcessing = false

  setPoliteRef(ref: HTMLDivElement | null) {
    this.politeRef = ref
  }

  setAssertiveRef(ref: HTMLDivElement | null) {
    this.assertiveRef = ref
  }

  announce(message: string, politeness: PolitenessLevel = 'polite') {
    if (!message.trim()) return

    // Add to queue with timestamp
    this.queue.push({
      message: message.trim(),
      politeness,
      timestamp: Date.now()
    })

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  private async processQueue() {
    this.isProcessing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) continue

      const targetRef = item.politeness === 'assertive' ? this.assertiveRef : this.politeRef
      if (targetRef) {
        // Clear previous message
        targetRef.textContent = ''
        
        // Small delay to ensure screen readers notice the change
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Set new message
        targetRef.textContent = item.message
        
        // Wait before processing next message
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    this.isProcessing = false
  }

  clear() {
    this.queue = []
    if (this.politeRef) this.politeRef.textContent = ''
    if (this.assertiveRef) this.assertiveRef.textContent = ''
  }
}

// Global instance
const statusManager = new StatusManager()

/**
 * Global Status Announcer with Live Regions
 */
export function GlobalStatusAnnouncer() {
  const politeRef = useRef<HTMLDivElement>(null)
  const assertiveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    statusManager.setPoliteRef(politeRef.current)
    statusManager.setAssertiveRef(assertiveRef.current)

    return () => {
      statusManager.setPoliteRef(null)
      statusManager.setAssertiveRef(null)
    }
  }, [])

  return (
    <>
      {/* Polite announcements */}
      <div
        ref={politeRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      />
      
      {/* Assertive/urgent announcements */}
      <div
        ref={assertiveRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      />
    </>
  )
}

/**
 * Hook for announcing status messages
 */
export function useAnnounce() {
  return {
    announce: (message: string, politeness: PolitenessLevel = 'polite') => {
      statusManager.announce(message, politeness)
    },
    announcePolite: (message: string) => {
      statusManager.announce(message, 'polite')
    },
    announceAssertive: (message: string) => {
      statusManager.announce(message, 'assertive')
    },
    clear: () => {
      statusManager.clear()
    }
  }
}

/**
 * Common announcement messages
 */
export const ANNOUNCEMENT_MESSAGES = {
  // Loading states
  LOADING: 'Loading...',
  LOADING_COMPLETE: 'Loading complete',
  
  // Form interactions
  FORM_SAVED: 'Form saved successfully',
  FORM_ERROR: 'Form contains errors. Please review and try again.',
  FORM_SUBMITTING: 'Submitting form...',
  
  // Navigation
  PAGE_LOADED: 'Page loaded',
  NAVIGATION_CHANGED: 'Navigation changed',
  
  // Application specific
  APPLICATION_SAVED: 'Application saved successfully',
  APPLICATION_DELETED: 'Application deleted',
  STATUS_UPDATED: 'Application status updated',
  
  // Search and filtering
  SEARCH_RESULTS: (count: number) => `${count} search results found`,
  FILTER_APPLIED: 'Filter applied to results',
  FILTER_CLEARED: 'Filters cleared',
  
  // Errors
  NETWORK_ERROR: 'Network error occurred. Please try again.',
  PERMISSION_DENIED: 'Permission denied',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
} as const

/**
 * Helper component for form validation announcements
 */
export function FormValidationAnnouncer({ 
  errors, 
  isSubmitting, 
  isSubmitted 
}: { 
  errors?: Record<string, string>
  isSubmitting?: boolean
  isSubmitted?: boolean 
}) {
  const { announce } = useAnnounce()
  const prevErrorCount = useRef(0)

  useEffect(() => {
    if (isSubmitting) {
      announce(ANNOUNCEMENT_MESSAGES.FORM_SUBMITTING)
    }
  }, [isSubmitting, announce])

  useEffect(() => {
    if (isSubmitted && errors) {
      const errorCount = Object.keys(errors).length
      
      if (errorCount > 0) {
        const message = errorCount === 1 
          ? '1 form error found. Please review and correct.'
          : `${errorCount} form errors found. Please review and correct.`
        announce(message, 'assertive')
      } else if (prevErrorCount.current > 0) {
        announce(ANNOUNCEMENT_MESSAGES.FORM_SAVED)
      }
      
      prevErrorCount.current = errorCount
    }
  }, [isSubmitted, errors, announce])

  return null
}

export default StatusAnnouncer