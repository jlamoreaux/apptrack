// Plan configuration constants
export const PLAN_LIMITS = {
  FREE_MAX_APPLICATIONS: 5,
} as const

export const PLAN_NAMES = {
  FREE: "Free",
  PRO: "Pro",
  AI_COACH: "AI Coach",
} as const

export const BILLING_CYCLES = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const

export const PLAN_FEATURES = {
  // Base features available to all plans
  BASE: ["Application tracking", "Interview notes", "Contact management"],

  // Pro-specific features
  PRO: ["Priority support"],

  // AI Coach specific features
  AI_COACH: [
    "AI resume analysis",
    "AI interview preparation",
    "AI cover letter generation",
    "Personalized career advice",
  ],
} as const

export const PLAN_ICONS = {
  [PLAN_NAMES.FREE]: null,
  [PLAN_NAMES.PRO]: "crown",
  [PLAN_NAMES.AI_COACH]: "bot",
} as const

export const PLAN_BADGES = {
  [PLAN_NAMES.FREE]: null,
  [PLAN_NAMES.PRO]: {
    text: "Most Popular",
    icon: "crown",
    className: "bg-secondary text-secondary-foreground",
  },
  [PLAN_NAMES.AI_COACH]: {
    text: "AI Powered",
    icon: "sparkles",
    className: "bg-gradient-to-r from-purple-600 to-blue-600 text-white",
  },
} as const

export const YEARLY_SAVINGS = {
  [PLAN_NAMES.PRO]: 4,
  [PLAN_NAMES.AI_COACH]: 18,
} as const
