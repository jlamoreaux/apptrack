/**
 * Navigation utilities to avoid side effects in components
 * Provides safe navigation methods for React components
 */

import { useRouter } from "next/navigation"
import { useCallback } from "react"

/**
 * Custom hook for safe navigation without side effects
 */
export function useNavigation() {
  const router = useRouter()

  const navigateTo = useCallback((path: string, options?: {
    replace?: boolean
    external?: boolean
  }) => {
    if (options?.external) {
      // For external links, use window.open to avoid navigation side effects
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }

    if (options?.replace) {
      router.replace(path)
    } else {
      router.push(path)
    }
  }, [router])

  const navigateToUpgrade = useCallback(() => {
    navigateTo('/dashboard/upgrade')
  }, [navigateTo])

  const navigateToSettings = useCallback(() => {
    navigateTo('/dashboard/settings')
  }, [navigateTo])

  const navigateBack = useCallback(() => {
    router.back()
  }, [router])

  const navigateToApplication = useCallback((applicationId: string) => {
    navigateTo(`/dashboard/application/${applicationId}`)
  }, [navigateTo])

  return {
    navigateTo,
    navigateToUpgrade,
    navigateToSettings,
    navigateBack,
    navigateToApplication,
  }
}

/**
 * Safe navigation function for use outside of React components
 */
export function safeNavigate(path: string, options?: {
  replace?: boolean
  external?: boolean
}) {
  if (typeof window === 'undefined') {
    // Server-side rendering - no navigation
    return
  }

  if (options?.external) {
    window.open(path, '_blank', 'noopener,noreferrer')
    return
  }

  if (options?.replace) {
    window.location.replace(path)
  } else {
    window.location.href = path
  }
}

/**
 * Creates a safe click handler for navigation
 */
export function createNavigationHandler(
  path: string,
  options?: {
    replace?: boolean
    external?: boolean
    preventDefault?: boolean
  }
) {
  return (event: React.MouseEvent) => {
    if (options?.preventDefault !== false) {
      event.preventDefault()
    }
    
    safeNavigate(path, options)
  }
}

/**
 * Hook for creating navigation handlers with proper event handling
 */
export function useNavigationHandlers() {
  const { navigateTo } = useNavigation()

  const createHandler = useCallback((
    path: string,
    options?: {
      replace?: boolean
      external?: boolean
      preventDefault?: boolean
    }
  ) => {
    return (event: React.MouseEvent) => {
      if (options?.preventDefault !== false) {
        event.preventDefault()
        event.stopPropagation()
      }
      
      navigateTo(path, options)
    }
  }, [navigateTo])

  return {
    createHandler,
    createUpgradeHandler: () => createHandler('/dashboard/upgrade'),
    createSettingsHandler: () => createHandler('/dashboard/settings'),
  }
}