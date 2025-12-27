// Application route constants - centralized URL management
export const APP_ROUTES = {
  // Public routes
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",

  // Dashboard routes
  DASHBOARD: {
    ROOT: "/dashboard",
    APPLICATIONS: "/dashboard/applications",
    AI_COACH: "/dashboard/ai-coach",
    // ANALYTICS: "/dashboard/analytics",
    SETTINGS: "/dashboard/settings",
    UPGRADE: "/dashboard/upgrade",
    ARCHIVED: "/dashboard/archived",
    ADD_APPLICATION: "/dashboard/add",
  },

  // AI Coach sub-routes with query params
  AI_COACH_TABS: {
    RESUME: "/dashboard/ai-coach?tab=resume",
    INTERVIEW: "/dashboard/ai-coach?tab=interview",
    COVER_LETTER: "/dashboard/ai-coach?tab=cover-letter",
    ADVICE: "/dashboard/ai-coach?tab=advice",
    JOB_FIT: "/dashboard/ai-coach?tab=job-fit",
  },

  // Special URLs
  UPGRADE_AI_COACH: "/dashboard/upgrade?highlight=ai-coach",

  // Dynamic routes (functions for parameterized URLs)
  DYNAMIC: {
    application: (id: string) => `/dashboard/application/${id}`,
    aiCoachWithApplication: (applicationId: string, tab: string) =>
      `/dashboard/ai-coach?tab=${tab}&applicationId=${applicationId}`,
  },
} as const;

// Navigation breadcrumb helpers
export const ROUTE_LABELS = {
  [APP_ROUTES.DASHBOARD.ROOT]: "Dashboard",
  [APP_ROUTES.DASHBOARD.APPLICATIONS]: "Applications",
  [APP_ROUTES.DASHBOARD.AI_COACH]: "AI Coach",
  // [APP_ROUTES.DASHBOARD.ANALYTICS]: "Analytics",
  [APP_ROUTES.DASHBOARD.SETTINGS]: "Settings",
  [APP_ROUTES.DASHBOARD.UPGRADE]: "Upgrade",
} as const;

// Route access requirements
export const ROUTE_ACCESS = {
  [APP_ROUTES.DASHBOARD.AI_COACH]: "ai_coach",
  // Add other restricted routes as needed
} as const;
