import { Plan } from "@/types";
import { PLAN_NAMES, FEATURE_ACCESS } from "./plans";

// Permission levels for different user types
export const PERMISSION_LEVELS = {
  FREE: "free",
  PRO: "pro",
  AI_COACH: "ai_coach",
} as const;

// API endpoint permissions
export const API_PERMISSIONS = {
  // AI Coach endpoints - only AI Coach users
  AI_COACH: {
    ANALYZE_RESUME: [PLAN_NAMES.AI_COACH],
    INTERVIEW_PREP: [PLAN_NAMES.AI_COACH],
    CAREER_ADVICE: [PLAN_NAMES.AI_COACH],
    COVER_LETTER: [PLAN_NAMES.AI_COACH],
    JOB_FIT_ANALYSIS: [PLAN_NAMES.AI_COACH],
    UPLOAD_RESUME: [PLAN_NAMES.AI_COACH],
    FETCH_JOB_DESCRIPTION: [PLAN_NAMES.AI_COACH],
  },

  // Subscription management - all authenticated users
  SUBSCRIPTION: {
    CHECK: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    CREATE_CHECKOUT: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    CANCEL: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    WEBHOOK: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH], // Stripe webhook
  },

  // Application management - all authenticated users
  APPLICATIONS: {
    CREATE: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    READ: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    UPDATE: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    DELETE: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },
} as const;

// UI component permissions
export const UI_PERMISSIONS = {
  // Dashboard sections
  DASHBOARD: {
    AI_COACH_TAB: [PLAN_NAMES.AI_COACH],
    UPGRADE_BANNER: [PLAN_NAMES.FREE],
    USAGE_BANNER: [PLAN_NAMES.FREE, PLAN_NAMES.PRO], // Show for limited plans
  },

  // Navigation items
  NAVIGATION: {
    AI_COACH_LINK: [PLAN_NAMES.AI_COACH],
    UPGRADE_LINK: [PLAN_NAMES.FREE],
    SUBSCRIPTION_MANAGEMENT: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },

  // Feature access
  FEATURES: {
    UNLIMITED_APPLICATIONS: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    AI_FEATURES: [PLAN_NAMES.AI_COACH],
    PRIORITY_SUPPORT: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },
} as const;

// Helper functions for permission checks
export const hasApiPermission = (
  userPlan: keyof typeof PLAN_NAMES,
  endpoint: keyof typeof API_PERMISSIONS.AI_COACH
): boolean => {
  const allowedPlans = API_PERMISSIONS.AI_COACH[endpoint] as readonly string[];
  return allowedPlans.includes(userPlan);
};

export const hasUIPermission = (
  userPlan: keyof typeof PLAN_NAMES,
  section: keyof typeof UI_PERMISSIONS.DASHBOARD
): boolean => {
  const permissions = UI_PERMISSIONS.DASHBOARD[section] as readonly string[];
  return permissions.includes(userPlan);
};

export const canAccessFeature = (
  userPlan: string,
  feature: string
): boolean => {
  // Check AI Coach features
  if (feature in FEATURE_ACCESS.AI_COACH_FEATURES) {
    const allowedPlans =
      FEATURE_ACCESS.AI_COACH_FEATURES[
        feature as keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
      ];
    return allowedPlans.includes(userPlan as any);
  }
  // Check Pro features
  if (feature in FEATURE_ACCESS.PRO_FEATURES) {
    const allowedPlans =
      FEATURE_ACCESS.PRO_FEATURES[
        feature as keyof typeof FEATURE_ACCESS.PRO_FEATURES
      ];
    return allowedPlans.includes(userPlan as any);
  }
  return false;
};

// Permission check results
export const PERMISSION_RESULTS = {
  ALLOWED: "allowed",
  DENIED: "denied",
  UPGRADE_REQUIRED: "upgrade_required",
} as const;
