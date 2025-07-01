/**
 * Focus Management Hooks for Accessibility
 * 
 * Provides utilities for managing focus in complex UI components
 * including focus traps, focus restoration, and keyboard navigation.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react'

// Constants for focus management
const FOCUS_DELAY_MS = 100 // Delay before focusing elements after mount
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ')

/**
 * Shared utility to get focusable elements within a container
 * Optimized for performance with cached selectors
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS))
}

/**
 * Hook for managing focus traps in modals and dialogs
 */
export function useFocusTrap(isActive: boolean = false) {
  const containerRef = useRef<HTMLElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)


  // Handle keydown events for focus trapping
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isActive || !containerRef.current) return
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(containerRef.current)
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      // Shift + Tab: move to previous element
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: move to next element  
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }, [isActive, getFocusableElements])

  // Set up focus trap when active
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    // Focus the first focusable element in the container after a short delay
    // This ensures the DOM has settled after mounting
    const focusableElements = getFocusableElements(containerRef.current)
    if (focusableElements.length > 0) {
      setTimeout(() => {
        focusableElements[0].focus()
      }, FOCUS_DELAY_MS)
    }

    // Add event listener for Tab key
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      
      // Restore focus to the previously focused element after a short delay
      if (previousActiveElement.current) {
        setTimeout(() => {
          if (previousActiveElement.current) {
            previousActiveElement.current.focus()
          }
        }, FOCUS_DELAY_MS)
      }
    }
  }, [isActive, handleKeyDown, getFocusableElements])

  return containerRef
}

/**
 * Hook for managing focus within a specific container
 */
export function useFocusWithin() {
  const containerRef = useRef<HTMLElement>(null)

  const focusFirst = useCallback(() => {
    if (!containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)
    const firstElement = focusableElements[0]
    if (firstElement) {
      firstElement.focus()
    }
  }, [])

  const focusLast = useCallback(() => {
    if (!containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)
    const lastElement = focusableElements[focusableElements.length - 1]
    if (lastElement) {
      lastElement.focus()
    }
  }, [])

  return {
    containerRef,
    focusFirst,
    focusLast
  }
}

/**
 * Hook for keyboard navigation in lists and grids
 */
export function useKeyboardNavigation(
  options: {
    direction?: 'vertical' | 'horizontal' | 'both'
    loop?: boolean
    onEscape?: () => void
  } = {}
) {
  const { direction = 'both', loop = true, onEscape } = options
  const containerRef = useRef<HTMLElement>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)

    if (focusableElements.length === 0) return

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    let targetIndex = currentIndex

    switch (event.key) {
      case 'ArrowDown':
        if (direction === 'vertical' || direction === 'both') {
          event.preventDefault()
          targetIndex = currentIndex + 1
          if (targetIndex >= focusableElements.length) {
            targetIndex = loop ? 0 : focusableElements.length - 1
          }
        }
        break

      case 'ArrowUp':
        if (direction === 'vertical' || direction === 'both') {
          event.preventDefault()
          targetIndex = currentIndex - 1
          if (targetIndex < 0) {
            targetIndex = loop ? focusableElements.length - 1 : 0
          }
        }
        break

      case 'ArrowRight':
        if (direction === 'horizontal' || direction === 'both') {
          event.preventDefault()
          targetIndex = currentIndex + 1
          if (targetIndex >= focusableElements.length) {
            targetIndex = loop ? 0 : focusableElements.length - 1
          }
        }
        break

      case 'ArrowLeft':
        if (direction === 'horizontal' || direction === 'both') {
          event.preventDefault()
          targetIndex = currentIndex - 1
          if (targetIndex < 0) {
            targetIndex = loop ? focusableElements.length - 1 : 0
          }
        }
        break

      case 'Home':
        event.preventDefault()
        targetIndex = 0
        break

      case 'End':
        event.preventDefault()
        targetIndex = focusableElements.length - 1
        break

      case 'Escape':
        if (onEscape) {
          event.preventDefault()
          onEscape()
        }
        break

      default:
        return
    }

    if (targetIndex !== currentIndex && focusableElements[targetIndex]) {
      focusableElements[targetIndex].focus()
    }
  }, [direction, loop, onEscape])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return containerRef
}

/**
 * Hook for managing focus restoration after navigation
 */
export function useFocusRestore() {
  const previousFocus = useRef<HTMLElement | null>(null)

  const saveFocus = useCallback(() => {
    previousFocus.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = useCallback(() => {
    if (previousFocus.current && document.contains(previousFocus.current)) {
      // Use delay to ensure smooth focus restoration
      setTimeout(() => {
        if (previousFocus.current && document.contains(previousFocus.current)) {
          previousFocus.current.focus()
        }
      }, FOCUS_DELAY_MS)
    }
  }, [])

  return { saveFocus, restoreFocus }
}

/**
 * Hook for managing roving tabindex in complex widgets
 */
export function useRovingTabIndex(defaultIndex: number = 0) {
  const containerRef = useRef<HTMLElement>(null)
  const currentIndex = useRef(defaultIndex)

  const updateTabIndex = useCallback((activeIndex: number) => {
    if (!containerRef.current) return

    const items = Array.from(
      containerRef.current.querySelectorAll('[role="tab"], [role="option"], [role="menuitem"]')
    ) as HTMLElement[]

    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.setAttribute('tabindex', '0')
        currentIndex.current = index
      } else {
        item.setAttribute('tabindex', '-1')
      }
    })
  }, [])

  const focusItem = useCallback((index: number) => {
    if (!containerRef.current) return

    const items = Array.from(
      containerRef.current.querySelectorAll('[role="tab"], [role="option"], [role="menuitem"]')
    ) as HTMLElement[]

    if (items[index]) {
      updateTabIndex(index)
      // Use delay for smoother focus transitions in complex widgets
      setTimeout(() => {
        if (items[index]) {
          items[index].focus()
        }
      }, FOCUS_DELAY_MS)
    }
  }, [updateTabIndex])

  // Initialize tabindex on mount
  useEffect(() => {
    updateTabIndex(defaultIndex)
  }, [defaultIndex, updateTabIndex])

  return {
    containerRef,
    focusItem,
    updateTabIndex,
    getCurrentIndex: () => currentIndex.current
  }
}