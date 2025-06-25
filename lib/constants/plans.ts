// Plan configuration constants
export const PLAN_LIMITS = {
  FREE_MAX_APPLICATIONS: 5,
} as const;

export const PLAN_NAMES = {
  FREE: "Free",
  PRO: "Pro",
  AI_COACH: "AI Coach",
} as const;

export const BILLING_CYCLES = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

// Feature access rules - what each plan can access
export const FEATURE_ACCESS = {
  // Core features available to all plans
  CORE: {
    APPLICATION_TRACKING: [
      PLAN_NAMES.FREE,
      PLAN_NAMES.PRO,
      PLAN_NAMES.AI_COACH,
    ],
    INTERVIEW_NOTES: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    CONTACT_MANAGEMENT: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },

  // Pro features (available to Pro and AI Coach)
  PRO_FEATURES: {
    UNLIMITED_APPLICATIONS: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    PRIORITY_SUPPORT: [PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },

  // AI Coach features (only available to AI Coach plan)
  AI_COACH_FEATURES: {
    RESUME_ANALYSIS: [PLAN_NAMES.AI_COACH],
    INTERVIEW_PREP: [PLAN_NAMES.AI_COACH],
    CAREER_ADVICE: [PLAN_NAMES.AI_COACH],
    COVER_LETTER_GENERATION: [PLAN_NAMES.AI_COACH],
    JOB_FIT_ANALYSIS: [PLAN_NAMES.AI_COACH],
  },
} as const;

export const PLAN_FEATURES = {
  // Base features available to all plans
  BASE: ["Application tracking", "Interview notes", "Contact management"],

  // Pro-specific features
  PRO: ["Priority support", "Unlimited applications"],

  // AI Coach specific features
  AI_COACH: [
    "AI resume analysis",
    "AI interview preparation",
    "AI cover letter generation",
    "Personalized career advice",
    "Job fit analysis",
  ],
} as const;

export const PLAN_ICONS = {
  [PLAN_NAMES.FREE]: null,
  [PLAN_NAMES.PRO]: "crown",
  [PLAN_NAMES.AI_COACH]: "bot",
} as const;

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
} as const;

export const YEARLY_SAVINGS = {
  [PLAN_NAMES.PRO]: 4,
  [PLAN_NAMES.AI_COACH]: 18,
} as const;

// Helper functions for plan access
export const hasFeatureAccess = (
  userPlan: string,
  feature:
    | keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
    | keyof typeof FEATURE_ACCESS.PRO_FEATURES
): boolean => {
  if (feature in FEATURE_ACCESS.AI_COACH_FEATURES) {
    return FEATURE_ACCESS.AI_COACH_FEATURES[
      feature as keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
    ].includes(userPlan as any);
  }
  if (feature in FEATURE_ACCESS.PRO_FEATURES) {
    return FEATURE_ACCESS.PRO_FEATURES[
      feature as keyof typeof FEATURE_ACCESS.PRO_FEATURES
    ].includes(userPlan as any);
  }
  return false;
};

export const isAICoachFeature = (feature: string): boolean => {
  return Object.keys(FEATURE_ACCESS.AI_COACH_FEATURES).includes(feature);
};

export const isProFeature = (feature: string): boolean => {
  return Object.keys(FEATURE_ACCESS.PRO_FEATURES).includes(feature);
};
