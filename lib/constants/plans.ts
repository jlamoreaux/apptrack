// Plan configuration constants
// CareerOtter pricing model (D2): the line is AI, not tracking. Every tier gets
// unlimited application tracking; Pro unlocks the model-calling features.
export const PLAN_LIMITS = {
  FREE_MAX_APPLICATIONS: -1, // Unlimited tracking for all tiers (the wall is AI, not count)
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

  // AI (model-calling) features. CareerOtter's single entitlement line: any paid
  // plan unlocks these. PRO is the go-forward name; AI_COACH is the same tier
  // pre-rename, kept so existing DB rows and subscribers keep access.
  AI_COACH_FEATURES: {
    RESUME_ANALYSIS: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    INTERVIEW_PREP: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    CAREER_ADVICE: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    COVER_LETTER_GENERATION: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    JOB_FIT_ANALYSIS: [PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
    // Unlimited tracking is now every tier, Free included — the wall is AI, not count.
    UNLIMITED_APPLICATIONS: [PLAN_NAMES.FREE, PLAN_NAMES.AI_COACH, PLAN_NAMES.PRO],
  },
} as const;

export const PLAN_FEATURES = {
  // Free tier features (every non-AI tool)
  FREE: [
    "Unlimited application tracking",
    "Roast My Resume",
    "Sankey charts & analytics",
    "Interview notes",
    "Contact management",
    "Export capabilities",
  ],

  // Pro features (every AI tool). Same list surfaced for AI_COACH pre-rename.
  AI_COACH: [
    "Everything in Free",
    "AI resume analysis",
    "AI interview preparation",
    "AI job fit analysis",
    "Custom cover letter generation",
    "Cancel reminder when hired",
  ],
  
  // Grandfathered Pro features (not shown to new users)
  // Grandfathered Pro. Tracking is unlimited on every tier now, so it's not
  // listed here as a paid differentiator.
  PRO: [
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
  feature: keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
): boolean => {
  if (feature in FEATURE_ACCESS.AI_COACH_FEATURES) {
    return FEATURE_ACCESS.AI_COACH_FEATURES[
      feature as keyof typeof FEATURE_ACCESS.AI_COACH_FEATURES
    ].includes(userPlan as any);
  }
  return false;
};

export const isAICoachFeature = (feature: string): boolean => {
  return Object.keys(FEATURE_ACCESS.AI_COACH_FEATURES).includes(feature);
};
