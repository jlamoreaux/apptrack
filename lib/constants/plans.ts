// Plan configuration constants
export const PLAN_LIMITS = {
  FREE_MAX_APPLICATIONS: 100, // Updated to 100 for generous free tier
  GRANDFATHERED_PRO_MAX_APPLICATIONS: -1, // Unlimited for grandfathered Pro users
} as const;

export const PLAN_NAMES = {
  FREE: "Free",
  PRO: "Pro", // Kept for grandfathered users
  AI_COACH: "AI Coach",
} as const;

// Active plans for new users (2-tier structure)
export const ACTIVE_PLANS = {
  FREE: "Free",
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
      PLAN_NAMES.PRO, // Grandfathered
      PLAN_NAMES.AI_COACH,
    ],
    INTERVIEW_NOTES: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    CONTACT_MANAGEMENT: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    SANKEY_CHARTS: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    ANALYTICS: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
    EXPORT: [PLAN_NAMES.FREE, PLAN_NAMES.PRO, PLAN_NAMES.AI_COACH],
  },

  // AI Coach features (only available to AI Coach plan)
  AI_COACH_FEATURES: {
    RESUME_ANALYSIS: [PLAN_NAMES.AI_COACH],
    INTERVIEW_PREP: [PLAN_NAMES.AI_COACH],
    CAREER_ADVICE: [PLAN_NAMES.AI_COACH],
    COVER_LETTER_GENERATION: [PLAN_NAMES.AI_COACH],
    JOB_FIT_ANALYSIS: [PLAN_NAMES.AI_COACH],
    UNLIMITED_APPLICATIONS: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO], // Pro users are grandfathered
  },
} as const;

export const PLAN_FEATURES = {
  // Free tier features
  FREE: [
    "Up to 100 applications",
    "All tracking features",
    "Sankey charts & analytics", 
    "Interview notes",
    "Contact management",
    "Export capabilities",
  ],

  // AI Coach features
  AI_COACH: [
    "Everything in Free",
    "Unlimited applications",
    "AI resume analysis",
    "AI interview preparation",
    "AI job fit analysis",
    "Custom cover letter generation",
    "Cancel reminder when hired",
  ],
  
  // Grandfathered Pro features (not shown to new users)
  PRO: [
    "Unlimited applications",
    "All tracking features",
    "Priority support",
  ],
} as const;

export const PLAN_ICONS = {
  [PLAN_NAMES.FREE]: null,
  [PLAN_NAMES.PRO]: "crown",
  [PLAN_NAMES.AI_COACH]: "bot",
} as const;

export const PLAN_BADGES = {
  [PLAN_NAMES.FREE]: null,
  [PLAN_NAMES.PRO]: null, // No badge for grandfathered plan
  [PLAN_NAMES.AI_COACH]: {
    text: "Most Popular",
    icon: "sparkles",
    className: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white",
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
