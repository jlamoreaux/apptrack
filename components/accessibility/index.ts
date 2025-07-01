/**
 * Accessibility Components Index
 * 
 * Centralized exports for all accessibility-related components
 * and utilities in the AppTrack application.
 */

// Skip navigation components
export { SkipLink, SkipNavigation } from './skip-link'

// Focus management components
export { default as FocusTrap } from './focus-trap'

// Accessible form components
export {
  AccessibleFormField,
  AccessibleInput,
  AccessibleSelect,
  AccessibleTextarea,
  AccessibleFieldset,
  AccessibleRadioGroup
} from './accessible-form'

// Re-export hooks for external use
export {
  useFocusTrap,
  useFocusWithin,
  useKeyboardNavigation,
  useFocusRestore,
  useRovingTabIndex
} from '@/hooks/use-focus-management'

// Accessibility constants
export { ACCESSIBLE_COLORS, getStatusColors, getStatusClasses } from '@/lib/constants/accessible-colors'