/**
 * Focus Trap Component for Modal Dialogs
 * 
 * Automatically manages focus within a container, ensuring keyboard users
 * cannot tab outside of modal content. Restores focus when trap is disabled.
 */

import { useEffect, forwardRef } from 'react'
import { useFocusTrap } from '@/hooks/use-focus-management'

interface FocusTrapProps {
  isActive: boolean
  children: React.ReactNode
  className?: string
  restoreFocus?: boolean
}

export const FocusTrap = forwardRef<HTMLDivElement, FocusTrapProps>(
  ({ isActive, children, className, restoreFocus = true, ...props }, ref) => {
    const focusTrapRef = useFocusTrap(isActive)

    // Merge refs if both are provided
    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(focusTrapRef.current)
      } else if (ref && 'current' in ref) {
        ref.current = focusTrapRef.current
      }
    }, [ref, focusTrapRef])

    return (
      <div
        ref={focusTrapRef}
        className={className}
        {...props}
      >
        {children}
      </div>
    )
  }
)

FocusTrap.displayName = 'FocusTrap'

export default FocusTrap