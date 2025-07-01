import { Badge } from "@/components/ui/badge"
import { getStatusClasses, getStatusColors } from "@/lib/constants/accessible-colors"
import { ApplicationStatus, isApplicationStatus } from "@/lib/constants/application-status"

interface StatusBadgeProps {
  /** The application status to display */
  status: string | ApplicationStatus
  /** Additional CSS classes to apply */
  className?: string
  /** Custom ARIA label override */
  ariaLabel?: string
  /** Whether to show a subtle variant (optional future enhancement) */
  variant?: 'default' | 'subtle'
}

/**
 * StatusBadge Component
 * 
 * A WCAG AA compliant status badge that displays application status with
 * appropriate colors, accessibility attributes, and keyboard navigation support.
 * 
 * @param props - The component props
 * @returns A properly styled and accessible status badge
 */
export function StatusBadge({ 
  status, 
  className = "", 
  ariaLabel, 
  variant = 'default' 
}: StatusBadgeProps) {
  // Type-safe status validation with fallback
  if (!isApplicationStatus(status)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Invalid status provided to StatusBadge: ${status}. Falling back to 'Applied'.`)
    }
    status = 'Applied'
  }

  const statusConfig = getStatusColors(status)
  const { container } = getStatusClasses(status)
  
  // Generate accessible label
  const accessibleLabel = ariaLabel || `Application status: ${statusConfig.label}`
  
  return (
    <Badge 
      className={`${container} ${className}`}
      role="status"
      aria-label={accessibleLabel}
      data-status={status}
      data-testid={`status-badge-${status.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {statusConfig.label}
    </Badge>
  )
}
