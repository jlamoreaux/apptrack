import type { SubscriptionPlan } from "@/lib/supabase";
import {
  PLAN_NAMES,
  PLAN_LIMITS,
  PLAN_FEATURES,
  YEARLY_SAVINGS,
  FEATURE_ACCESS,
} from "@/lib/constants/plans";

export function getPlanFeatures(plan: SubscriptionPlan): string[] {
  // Start with database features if they exist
  const dbFeatures = plan.features || [];

  // Add base features for all plans
  const features: string[] = [];

  // Add plan-specific features based on plan name
  switch (plan.name) {
    case PLAN_NAMES.FREE:
      features.unshift(
        `Up to ${
          plan.max_applications || PLAN_LIMITS.FREE_MAX_APPLICATIONS
        } applications`
      );
      break;

    case PLAN_NAMES.PRO:
      features.unshift("Unlimited applications");
      features.push("Cancel reminder when hired");
      features.push(...PLAN_FEATURES.PRO);
      break;

    case PLAN_NAMES.AI_COACH:
      features.unshift("Everything in Free");
      features.push(...PLAN_FEATURES.AI_COACH);
      break;
  }

  // Merge with database features, preferring database features
  const allFeatures = [...new Set([...dbFeatures, ...features])];
  return allFeatures;
}

export function getPlanPrice(
  plan: SubscriptionPlan,
  billingCycle: "monthly" | "yearly"
): number {
  return billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly;
}

export function getYearlySavings(planName: string): number {
  return YEARLY_SAVINGS[planName as keyof typeof YEARLY_SAVINGS] || 0;
}

export function isPlanUnlimited(plan: SubscriptionPlan): boolean {
  return plan.max_applications === -1 || plan.max_applications === null;
}

export function getPlanDisplayLimit(plan: SubscriptionPlan): string {
  if (isPlanUnlimited(plan)) {
    return "unlimited";
  }
  return (
    plan.max_applications?.toString() ||
    PLAN_LIMITS.FREE_MAX_APPLICATIONS.toString()
  );
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
  };

  const key = feature.toLowerCase();
  return iconMap[key] || "check";
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
    features:
      dbPlan.features && dbPlan.features.length > 0
        ? dbPlan.features
        : config.features,
  };
}

/**
 * Check if a user plan has access to a specific feature
 */
export const hasFeatureAccess = (
  userPlan: string,
  feature: keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
): boolean => {
  if (feature in FEATURE_ACCESS.AI_COACH_FEATURES) {
    return FEATURE_ACCESS.AI_COACH_FEATURES[
      feature as keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
    ].includes(userPlan as any);
  }
  return false;
};

/**
 * Check if a feature is exclusive to AI Coach plan
 */
export const isAICoachFeature = (feature: string): boolean => {
  return Object.keys(FEATURE_ACCESS.AI_COACH_FEATURES).includes(feature);
};

/**
 * Check if user is on a paid plan (Pro or AI Coach)
 */
export const isOnPaidPlan = (userPlan: string): boolean => {
  return userPlan === PLAN_NAMES.PRO || userPlan === PLAN_NAMES.AI_COACH;
};

/**
 * Check if user is on Pro or higher plan
 */
export const isOnProOrHigher = (userPlan: string): boolean => {
  return userPlan === PLAN_NAMES.PRO || userPlan === PLAN_NAMES.AI_COACH;
};

/**
 * Check if user is on AI Coach plan
 */
export const isOnAICoachPlan = (userPlan: string): boolean => {
  return userPlan === PLAN_NAMES.AI_COACH;
};

/**
 * Check if user is on Free plan
 */
export const isOnFreePlan = (userPlan: string): boolean => {
  return userPlan === PLAN_NAMES.FREE;
};

/**
 * Get the display name for a plan
 */
export const getPlanDisplayName = (planName: string): string => {
  switch (planName) {
    case PLAN_NAMES.FREE:
      return "Free";
    case PLAN_NAMES.PRO:
      return "Pro";
    case PLAN_NAMES.AI_COACH:
      return "AI Coach";
    default:
      return "Unknown";
  }
};

/**
 * Get the features available for a specific plan
 */
export const getPlanFeaturesByName = (planName: string): string[] => {
  const features: string[] = [];

  // Add base features for all plans
  features.push(...FEATURE_ACCESS.CORE.APPLICATION_TRACKING);
  features.push(...FEATURE_ACCESS.CORE.INTERVIEW_NOTES);
  features.push(...FEATURE_ACCESS.CORE.CONTACT_MANAGEMENT);

  // Add AI Coach features (includes unlimited applications)
  if (isOnAICoachPlan(planName) || planName === PLAN_NAMES.PRO) {
    features.push(...FEATURE_ACCESS.AI_COACH_FEATURES.UNLIMITED_APPLICATIONS);
    features.push(...FEATURE_ACCESS.AI_COACH_FEATURES.RESUME_ANALYSIS);
    features.push(...FEATURE_ACCESS.AI_COACH_FEATURES.INTERVIEW_PREP);
    features.push(...FEATURE_ACCESS.AI_COACH_FEATURES.CAREER_ADVICE);
    features.push(...FEATURE_ACCESS.AI_COACH_FEATURES.COVER_LETTER_GENERATION);
    features.push(...FEATURE_ACCESS.AI_COACH_FEATURES.JOB_FIT_ANALYSIS);
  }

  return features;
};

/**
 * Get the upgrade message for a feature
 */
export const getUpgradeMessage = (
  feature: string,
  currentPlan: string
): string => {
  if (isAICoachFeature(feature)) {
    return "This feature requires an AI Coach subscription";
  }

  return "This feature is not available on your current plan";
};

/**
 * Get the required plan for a feature
 */
export const getRequiredPlan = (feature: string): string => {
  if (isAICoachFeature(feature)) {
    return PLAN_NAMES.AI_COACH;
  }

  return PLAN_NAMES.FREE;
};

/**
 * Check if user can access unlimited applications
 */
export const canAccessUnlimitedApplications = (userPlan: string): boolean => {
  return isOnProOrHigher(userPlan);
};

/**
 * Check if user can access AI features
 */
export const canAccessAIFeatures = (userPlan: string): boolean => {
  return isOnAICoachPlan(userPlan);
};

/**
 * Get application limit for user plan
 */
export const getApplicationLimit = (userPlan: string): number | null => {
  if (isOnFreePlan(userPlan)) {
    return PLAN_LIMITS.FREE_MAX_APPLICATIONS;
  }
  return null; // Unlimited for paid plans
};

/**
 * Get plan hierarchy level (0 = Free, 1 = Pro, 2 = AI Coach)
 */
export const getPlanLevel = (planName: string): number => {
  switch (planName) {
    case PLAN_NAMES.FREE:
      return 0;
    case PLAN_NAMES.PRO:
      return 1;
    case PLAN_NAMES.AI_COACH:
      return 2;
    default:
      return 0;
  }
};

/**
 * Check if a plan is a downgrade from the current plan
 */
export const isPlanDowngrade = (
  currentPlan: string,
  targetPlan: string
): boolean => {
  const currentLevel = getPlanLevel(currentPlan);
  const targetLevel = getPlanLevel(targetPlan);
  return targetLevel < currentLevel;
};

/**
 * Check if a plan is an upgrade from the current plan
 */
export const isPlanUpgrade = (
  currentPlan: string,
  targetPlan: string
): boolean => {
  const currentLevel = getPlanLevel(currentPlan);
  const targetLevel = getPlanLevel(targetPlan);
  return targetLevel > currentLevel;
};

/**
 * Get appropriate button text for plan card
 */
export const getPlanButtonText = (
  currentPlan: string,
  targetPlan: string,
  isCurrentPlan: boolean
): string => {
  if (isCurrentPlan) {
    return "Current Plan";
  }

  if (isPlanDowngrade(currentPlan, targetPlan)) {
    return "Downgrade";
  }

  if (isPlanUpgrade(currentPlan, targetPlan)) {
    return `Upgrade to ${targetPlan}`;
  }

  // Same level (shouldn't happen with current plans, but good to handle)
  return `Switch to ${targetPlan}`;
};
