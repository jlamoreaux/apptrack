import type { SubscriptionPlan } from "@/lib/supabase"
import { PLAN_NAMES, PLAN_LIMITS, PLAN_FEATURES, YEARLY_SAVINGS } from "@/lib/constants/plans"

export function getPlanFeatures(plan: SubscriptionPlan): string[] {
  // Start with database features if they exist
  const dbFeatures = plan.features || []

  // Add base features for all plans
  const features: string[] = []

  // Add plan-specific features based on plan name
  switch (plan.name) {
    case PLAN_NAMES.FREE:
      features.unshift(`Up to ${plan.max_applications || PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications`)
      break

    case PLAN_NAMES.PRO:
      features.unshift("Unlimited applications")
      features.push("Cancel reminder when hired")
      features.push(...PLAN_FEATURES.PRO)
      break

    case PLAN_NAMES.AI_COACH:
      features.unshift("Everything in Pro")
      features.push(...PLAN_FEATURES.AI_COACH)
      break
  }

  // Merge with database features, preferring database features
  const allFeatures = [...new Set([...dbFeatures, ...features])]
  return allFeatures
}

export function getPlanPrice(plan: SubscriptionPlan, billingCycle: "monthly" | "yearly"): number {
  return billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly
}

export function getYearlySavings(planName: string): number {
  return YEARLY_SAVINGS[planName as keyof typeof YEARLY_SAVINGS] || 0
}

export function isPlanUnlimited(plan: SubscriptionPlan): boolean {
  return plan.max_applications === -1 || plan.max_applications === null
}

export function getPlanDisplayLimit(plan: SubscriptionPlan): string {
  if (isPlanUnlimited(plan)) {
    return "unlimited"
  }
  return plan.max_applications?.toString() || PLAN_LIMITS.FREE_MAX_APPLICATIONS.toString()
}

export function getFeatureIcon(feature: string): string {
  // Map features to icons
  const iconMap: Record<string, string> = {
    "unlimited applications": "infinity",
    "ai resume analysis": "brain",
    "ai interview preparation": "message-square",
    "ai cover letter generation": "file-text",
    "personalized career advice": "target",
    "cancel reminder when hired": "heart",
    "priority support": "check",
    "everything in pro": "check",
    "all free plan features": "check",
  }

  const key = feature.toLowerCase()
  return iconMap[key] || "check"
}

// Helper to merge database plan with home page config
export function getHomePlanData(dbPlan: SubscriptionPlan, config: any) {
  return {
    ...config,
    price:
      dbPlan.name === PLAN_NAMES.FREE
        ? null
        : {
            amount: dbPlan.price_monthly,
            period: "month",
          },
    // Use database features if available, otherwise use config features
    features: dbPlan.features && dbPlan.features.length > 0 ? dbPlan.features : config.features,
  }
}
