// UI constants for consistent sizing and limits
export const UI_CONSTANTS = {
  // Application display limits
  LIMITS: {
    RECENT_APPLICATIONS: 2,
    DASHBOARD_APPLICATIONS: 3, 
    PREVIEW_APPLICATIONS: 10,
    MAX_FILE_SIZE_MB: 5,
  },

  // Icon and element sizes
  SIZES: {
    ICON: {
      XS: "h-3 w-3",
      SM: "h-4 w-4", 
      MD: "h-5 w-5",
      LG: "h-6 w-6",
      XL: "h-8 w-8",
      XXL: "h-10 w-10",
      HERO: "h-12 w-12",
      AVATAR: "h-20 w-20",
    },
    TEXT: {
      XS: "text-xs",
      SM: "text-sm", 
      BASE: "text-base",
      LG: "text-lg",
      XL: "text-xl",
      XXL: "text-2xl",
      HERO: "text-4xl",
    },
    CONTAINER: {
      MOBILE_NAV: "w-80",
      MAX_CONTENT: "max-w-2xl",
      MAX_WIDE: "max-w-6xl",
    },
  },

  // Spacing and layout
  SPACING: {
    HEADER_HEIGHT: "h-14",
    NAV_HEIGHT: "h-12", 
    CONTAINER_PADDING: "py-16 px-4",
    SECTION_SPACING: "space-y-8",
    CARD_PADDING: "p-4",
  },

  // Animation timing
  TRANSITIONS: {
    DEFAULT: "transition-all duration-200",
    FAST: "transition-all duration-150",
    SLOW: "transition-all duration-300",
  },
} as const;

// Feature development timeline
export const DEVELOPMENT_TIMELINE = {
  QUARTERS: {
    Q1_2025: "Q1 2025",
    Q2_2025: "Q2 2025", 
    Q3_2025: "Q3 2025",
    Q4_2025: "Q4 2025",
  },
  
  // Feature release schedule
  RELEASES: {
    APPLICATIONS_PAGE: "Q2 2025",
    ANALYTICS_DASHBOARD: "Q3 2025",
    MOBILE_APP: "Q4 2025",
  },
} as const;

// Coming soon page configurations
export const COMING_SOON_FEATURES = {
  APPLICATIONS: {
    EXPECTED_DATE: DEVELOPMENT_TIMELINE.RELEASES.APPLICATIONS_PAGE,
    FEATURES: [
      "Advanced filtering and search",
      "Bulk operations (archive, delete, update status)",
      "Application templates and quick add", 
      "Export applications to CSV/PDF",
      "Application deadline reminders",
      "Duplicate detection and merge",
      "Custom application fields",
    ],
  },
  
  ANALYTICS: {
    EXPECTED_DATE: DEVELOPMENT_TIMELINE.RELEASES.ANALYTICS_DASHBOARD,
    FEATURES: [
      "Application success rate tracking",
      "Response time analytics", 
      "Industry and company performance insights",
      "Salary range analysis and benchmarking",
      "Application funnel visualization",
      "Time-to-hire metrics",
      "Personalized job search recommendations",
    ],
  },
} as const;

// Notification settings
export const NOTIFICATIONS = {
  MESSAGES: {
    FEATURE_READY: "Get Notified When Ready",
    WORKING_ON_IT: "We're actively working on this feature. Stay tuned for updates!",
    COMING_SOON: "Coming Soon",
    BACK_TO_DASHBOARD: "Back to Dashboard",
  },
} as const;
