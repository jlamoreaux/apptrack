export type OnboardingStepType = 'modal' | 'tooltip' | 'spotlight' | 'banner'

export type OnboardingTrigger = 
  | 'first_login'
  | 'manual'
  | 'feature_launch'
  | 'incomplete_profile'
  | 'no_applications'
  | 'custom'

export interface OnboardingAction {
  label: string
  action?: 'next' | 'skip' | 'complete' | 'custom'
  href?: string
  onClick?: () => void | Promise<void>
}

export interface OnboardingStep {
  id: string
  type: OnboardingStepType
  title: string
  content: string | React.ReactNode
  image?: string
  target?: string // CSS selector for spotlight/tooltip
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  actions?: OnboardingAction[]
  skippable?: boolean
  persistent?: boolean // Don't auto-dismiss
}

export interface OnboardingFlow {
  id: string
  name: string
  description?: string
  version: number // For tracking updates
  triggers: OnboardingTrigger[]
  conditions?: OnboardingCondition[]
  steps: OnboardingStep[]
  priority?: number
  dismissible?: boolean
  resetOnUpdate?: boolean // Reset if version changes
}

export interface OnboardingCondition {
  type: 'user_property' | 'feature_flag' | 'custom'
  property?: string
  value?: unknown
  check?: (user: unknown) => boolean
}

export interface OnboardingProgress {
  flowId: string
  flowVersion: number
  currentStepIndex: number
  completedSteps: string[]
  skippedSteps: string[]
  startedAt: Date
  completedAt?: Date
  dismissed?: boolean
}

export interface UserOnboarding {
  userId: string
  flows: Record<string, OnboardingProgress>
  seenAnnouncements: string[]
  preferences: {
    enableTooltips: boolean
    enableAnnouncements: boolean
  }
}