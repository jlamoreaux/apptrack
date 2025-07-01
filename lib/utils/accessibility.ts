/**
 * Accessibility utilities for AI Analysis components
 * Provides WCAG-compliant attributes and keyboard navigation
 */

import { useEffect, useRef, useCallback } from "react"
import { AIAnalysisTab } from "@/types/ai-analysis"

/**
 * Generates accessibility attributes for tab navigation
 */
export function getTabAccessibilityProps(
  tabId: string,
  isSelected: boolean,
  index: number,
  totalTabs: number
) {
  return {
    role: 'tab' as const,
    'aria-selected': isSelected,
    'aria-controls': `tabpanel-${tabId}`,
    'aria-setsize': totalTabs,
    'aria-posinset': index + 1,
    id: `tab-${tabId}`,
    tabIndex: isSelected ? 0 : -1,
  }
}

/**
 * Generates accessibility attributes for tab panels
 */
export function getTabPanelAccessibilityProps(
  tabId: string,
  isActive: boolean
) {
  return {
    role: 'tabpanel' as const,
    'aria-labelledby': `tab-${tabId}`,
    id: `tabpanel-${tabId}`,
    tabIndex: isActive ? 0 : -1,
    hidden: !isActive,
  }
}

/**
 * Generates accessibility attributes for the tab list container
 */
export function getTabListAccessibilityProps(label: string) {
  return {
    role: 'tablist' as const,
    'aria-label': label,
    'aria-orientation': 'horizontal' as const,
  }
}

/**
 * Hook for managing keyboard navigation in tab components
 */
export function useTabKeyboardNavigation(
  activeTab: AIAnalysisTab,
  tabs: { id: AIAnalysisTab }[],
  onTabChange: (tab: AIAnalysisTab) => void
) {
  const tabRefs = useRef<Map<string, HTMLElement>>(new Map())

  const registerTab = useCallback((tabId: string, element: HTMLElement | null) => {
    if (element) {
      tabRefs.current.set(tabId, element)
    } else {
      tabRefs.current.delete(tabId)
    }
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    let newIndex = currentIndex

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        break
        
      case 'ArrowRight':
        event.preventDefault()
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        break
        
      case 'Home':
        event.preventDefault()
        newIndex = 0
        break
        
      case 'End':
        event.preventDefault()
        newIndex = tabs.length - 1
        break
        
      default:
        return // Don't handle other keys
    }

    const newTab = tabs[newIndex]
    if (newTab) {
      onTabChange(newTab.id)
      
      // Focus the new tab
      setTimeout(() => {
        const tabElement = tabRefs.current.get(newTab.id)
        if (tabElement) {
          tabElement.focus()
        }
      }, 0)
    }
  }, [activeTab, tabs, onTabChange])

  return {
    registerTab,
    handleKeyDown,
  }
}

/**
 * Hook for managing focus on tab changes
 */
export function useFocusManagement(activeTab: AIAnalysisTab) {
  const focusRef = useRef<HTMLElement | null>(null)

  const setFocusRef = useCallback((element: HTMLElement | null) => {
    focusRef.current = element
  }, [])

  useEffect(() => {
    // Focus the active tab when it changes
    if (focusRef.current) {
      focusRef.current.focus()
    }
  }, [activeTab])

  return {
    setFocusRef,
  }
}

/**
 * Generates ARIA live region attributes for dynamic content
 */
export function getLiveRegionProps(
  politeness: 'polite' | 'assertive' = 'polite',
  atomic: boolean = false
) {
  return {
    'aria-live': politeness,
    'aria-atomic': atomic,
    role: 'status' as const,
  }
}

/**
 * Generates accessibility attributes for loading states
 */
export function getLoadingAccessibilityProps(
  isLoading: boolean,
  loadingText: string = 'Loading...'
) {
  return {
    'aria-busy': isLoading,
    'aria-label': isLoading ? loadingText : undefined,
    'aria-describedby': isLoading ? 'loading-description' : undefined,
  }
}

/**
 * Generates accessibility attributes for error states
 */
export function getErrorAccessibilityProps(
  hasError: boolean,
  errorMessage?: string
) {
  return {
    'aria-invalid': hasError,
    'aria-describedby': hasError ? 'error-message' : undefined,
    'aria-errormessage': hasError && errorMessage ? 'error-message' : undefined,
  }
}

/**
 * Hook for announcing dynamic content changes to screen readers
 */
export function useScreenReaderAnnouncements() {
  const announcementRef = useRef<HTMLDivElement | null>(null)

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcementRef.current) {
      // Create announcement element if it doesn't exist
      const element = document.createElement('div')
      element.setAttribute('aria-live', priority)
      element.setAttribute('aria-atomic', 'true')
      element.className = 'sr-only' // Screen reader only
      element.style.position = 'absolute'
      element.style.left = '-10000px'
      element.style.width = '1px'
      element.style.height = '1px'
      element.style.overflow = 'hidden'
      
      document.body.appendChild(element)
      announcementRef.current = element
    }

    // Update the announcement
    announcementRef.current.setAttribute('aria-live', priority)
    announcementRef.current.textContent = message

    // Clear after announcement
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = ''
      }
    }, 1000)
  }, [])

  const announceSuccess = useCallback((message: string) => {
    announce(message, 'polite')
  }, [announce])

  const announceError = useCallback((message: string) => {
    announce(message, 'assertive')
  }, [announce])

  const announceLoading = useCallback((message: string = 'Content is loading') => {
    announce(message, 'polite')
  }, [announce])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (announcementRef.current && announcementRef.current.parentNode) {
        announcementRef.current.parentNode.removeChild(announcementRef.current)
      }
    }
  }, [])

  return {
    announce,
    announceSuccess,
    announceError,
    announceLoading,
  }
}

/**
 * Utility for creating skip links for keyboard navigation
 */
export function getSkipLinkProps(targetId: string, label: string) {
  return {
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-2 z-50',
    'aria-label': label,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const target = document.getElementById(targetId)
        if (target) {
          target.focus()
        }
      }
    },
  }
}

/**
 * Hook for managing reduced motion preferences
 */
export function useReducedMotion() {
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  return prefersReducedMotion
}

/**
 * Utility for creating accessible button props
 */
export function getAccessibleButtonProps(
  label: string,
  description?: string,
  isPressed?: boolean,
  isExpanded?: boolean
) {
  return {
    'aria-label': label,
    'aria-describedby': description ? `${label.toLowerCase().replace(/\s+/g, '-')}-description` : undefined,
    'aria-pressed': isPressed,
    'aria-expanded': isExpanded,
    type: 'button' as const,
  }
}