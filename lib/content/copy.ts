import copyData from "@/content/copy.json"
import { PLAN_LIMITS } from "@/lib/constants/plans"

// Type-safe access to copy with validation
export const COPY = {
  ...copyData,
  // Dynamic content that uses constants
  pricing: {
    ...copyData.pricing,
    plans: {
      ...copyData.pricing.plans,
      free: {
        ...copyData.pricing.plans.free,
        features: [
          `Up to ${PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications`,
          ...copyData.pricing.plans.free.features.slice(1),
        ],
      },
    },
  },
} as const

// Helper functions for copy access
export const getCopy = (path: string) => {
  return path.split(".").reduce((obj, key) => obj?.[key], COPY)
}

// Get plan copy by plan name
export const getPlanCopy = (planName: string) => {
  const planKey = planName.toLowerCase().replace(" ", "_")
  return COPY.pricing.plans[planKey as keyof typeof COPY.pricing.plans]
}

// Validate copy structure at build time
export const validateCopy = () => {
  const required = ["hero.title", "hero.subtitle", "pricing.title"]
  for (const path of required) {
    if (!getCopy(path)) {
      throw new Error(`Missing required copy: ${path}`)
    }
  }
}
