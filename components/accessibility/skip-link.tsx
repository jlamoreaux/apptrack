/**
 * Skip Link Component for Keyboard Navigation
 * 
 * Provides a way for keyboard users to skip repetitive navigation
 * and jump directly to the main content. Hidden by default but
 * becomes visible when focused.
 * 
 * WCAG 2.1 Guideline: 2.4.1 Bypass Blocks (Level A)
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SkipLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

export const SkipLink = forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ href, children, className, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={cn(
          // Hide by default, show on focus
          'sr-only focus:not-sr-only',
          // Position at top of page when focused
          'focus:absolute focus:top-2 focus:left-2 focus:z-50',
          // High contrast styling for visibility
          'focus:bg-primary focus:text-white',
          'focus:px-4 focus:py-2 focus:rounded-md',
          // Strong focus indicator
          'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary',
          // Typography for readability
          'text-sm font-medium',
          // Smooth transitions
          'transition-all duration-200',
          className
        )}
        {...props}
      >
        {children}
      </a>
    )
  }
)

SkipLink.displayName = 'SkipLink'

/**
 * Skip Navigation Component with common skip links
 */
export function SkipNavigation() {
  return (
    <div className="skip-navigation">
      <SkipLink href="#main-content">
        Skip to main content
      </SkipLink>
      <SkipLink href="#main-navigation">
        Skip to navigation
      </SkipLink>
    </div>
  )
}

export default SkipLink