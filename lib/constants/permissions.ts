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
  // Model-calling endpoints — any paid plan (Pro; AI Coach is the same tier
  // pre-rename, kept so existing subscribers/DB rows keep access).
  AI_COACH: {
    ANALYZE_RESUME: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    INTERVIEW_PREP: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    CAREER_ADVICE: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    COVER_LETTER: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    JOB_FIT_ANALYSIS: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    UPLOAD_RESUME: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    FETCH_JOB_DESCRIPTION: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
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
    AI_COACH_TAB: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    UPGRADE_BANNER: [PLAN_NAMES.FREE],
    // Tracking is unlimited for everyone now — no usage/limit banner for any plan.
    USAGE_BANNER: [] as string[],
  },

  // Navigation items
  NAVIGATION: {
    AI_COACH_LINK: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    UPGRADE_LINK: [PLAN_NAMES.FREE],
    SUBSCRIPTION_MANAGEMENT: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },

  // Feature access
  FEATURES: {
    UNLIMITED_APPLICATIONS: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    AI_FEATURES: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
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
  return false;
};

// Permission check results
export const PERMISSION_RESULTS = {
  ALLOWED: "allowed",
  DENIED: "denied",
  UPGRADE_REQUIRED: "upgrade_required",
} as const;
