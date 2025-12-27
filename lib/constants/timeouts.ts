/**
 * Application-wide timeout constants
 */

// UI Delays
export const UI_DELAYS = {
  AUTO_SELECT_PLAN: 1000, // 1 second delay for auto-selecting plans
  TOAST_DURATION: 4000,   // 4 seconds for toast notifications
  MODAL_ANIMATION: 200,   // 200ms for modal animations
} as const;

// API Timeouts
export const API_TIMEOUTS = {
  DEFAULT: 30000,        // 30 seconds default timeout
  STRIPE_CHECKOUT: 60000, // 60 seconds for Stripe operations
  AI_FEATURES: 120000,   // 2 minutes for AI operations
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  CLIENT_LOGGING: {
    WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    MAX_REQUESTS: 100,
    MAX_ENTRIES: 10000, // Maximum entries in memory
  },
  IP_RATE_LIMIT: {
    WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    MAX_REQUESTS: 20,
  }
} as const;

// Cleanup Intervals
export const CLEANUP_INTERVALS = {
  RATE_LIMIT_STORE: 5 * 60 * 1000, // 5 minutes
  SESSION_CLEANUP: 60 * 60 * 1000,  // 1 hour
} as const;