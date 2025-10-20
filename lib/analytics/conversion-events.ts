/**
 * Conversion funnel event definitions for PostHog tracking
 */

export const CONVERSION_EVENTS = {
  // Landing page events
  LANDING_PAGE_VIEW: "landing_page_view",
  HERO_SECTION_VIEWED: "hero_section_viewed",
  FEATURES_SECTION_VIEWED: "features_section_viewed",
  PRICING_SECTION_VIEWED: "pricing_section_viewed",
  
  // Signup flow
  SIGNUP_STARTED: "signup_started",
  SIGNUP_EMAIL_ENTERED: "signup_email_entered",
  SIGNUP_COMPLETED: "signup_completed",
  EMAIL_VERIFIED: "email_verified",
  
  // Onboarding & activation
  FIRST_APPLICATION_ADDED: "first_application_added",
  THIRD_APPLICATION_ADDED: "third_application_added",
  FIFTH_APPLICATION_ADDED: "fifth_application_added",
  
  // AI feature discovery
  AI_FEATURE_DISCOVERED: "ai_feature_discovered",
  AI_TEASER_VIEWED: "ai_feature_teaser_viewed",
  AI_UNLOCK_CLICKED: "ai_feature_unlock_clicked",
  AI_ANALYSIS_GENERATED: "ai_analysis_generated",
  
  // Upgrade flow
  UPGRADE_INITIATED: "upgrade_initiated",
  UPGRADE_PAGE_VIEWED: "upgrade_page_viewed",
  PAYMENT_METHOD_ENTERED: "payment_method_entered",
  UPGRADE_COMPLETED: "upgrade_completed",
  
  // Engagement
  DASHBOARD_VIEWED: "dashboard_viewed",
  APPLICATION_VIEWED: "application_viewed",
  APPLICATION_EDITED: "application_edited",
  
  // Referral program
  REFERRAL_LINK_COPIED: "referral_link_copied",
  REFERRAL_LINK_SHARED: "referral_link_shared",
  REFERRAL_PAGE_VISITED: "referral_page_visited",
  REFERRAL_SIGNUP_STARTED: "referral_signup_started",
  REFERRAL_SIGNUP_COMPLETED: "referral_signup_completed",
} as const;

export type ConversionEvent = typeof CONVERSION_EVENTS[keyof typeof CONVERSION_EVENTS];

/**
 * Conversion funnel steps for tracking user journey
 */
export const CONVERSION_FUNNEL = {
  VISITOR: [
    CONVERSION_EVENTS.LANDING_PAGE_VIEW,
    CONVERSION_EVENTS.PRICING_SECTION_VIEWED,
  ],
  LEAD: [
    CONVERSION_EVENTS.SIGNUP_STARTED,
    CONVERSION_EVENTS.SIGNUP_COMPLETED,
    CONVERSION_EVENTS.EMAIL_VERIFIED,
  ],
  ACTIVATED_USER: [
    CONVERSION_EVENTS.FIRST_APPLICATION_ADDED,
    CONVERSION_EVENTS.THIRD_APPLICATION_ADDED,
    CONVERSION_EVENTS.AI_FEATURE_DISCOVERED,
  ],
  QUALIFIED_LEAD: [
    CONVERSION_EVENTS.AI_TEASER_VIEWED,
    CONVERSION_EVENTS.AI_UNLOCK_CLICKED,
    CONVERSION_EVENTS.UPGRADE_INITIATED,
  ],
  CUSTOMER: [
    CONVERSION_EVENTS.UPGRADE_PAGE_VIEWED,
    CONVERSION_EVENTS.PAYMENT_METHOD_ENTERED,
    CONVERSION_EVENTS.UPGRADE_COMPLETED,
  ],
} as const;

/**
 * Event properties for additional context
 */
export interface ConversionEventProperties {
  // Common properties
  user_id?: string;
  session_id?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  
  // Page view properties
  page_name?: string;
  page_url?: string;
  
  // AI feature properties
  feature_name?: string;
  feature_location?: string;
  
  // Application properties
  application_count?: number;
  application_id?: string;
  
  // Upgrade properties
  plan_name?: string;
  price?: number;
  discount_code?: string;
  
  // A/B test properties
  experiment_name?: string;
  variant?: string;
}

/**
 * Track a conversion event
 */
export function trackConversionEvent(
  event: ConversionEvent,
  properties?: ConversionEventProperties
) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture(event, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track progression through conversion funnel
 */
export function trackFunnelStep(
  step: keyof typeof CONVERSION_FUNNEL,
  event: ConversionEvent,
  properties?: ConversionEventProperties
) {
  trackConversionEvent(event, {
    ...properties,
    funnel_step: step,
    funnel_name: "main_conversion",
  });
}

/**
 * Helper to track feature engagement
 */
export function trackFeatureEngagement(
  featureName: string,
  action: "viewed" | "clicked" | "used",
  properties?: Omit<ConversionEventProperties, "feature_name">
) {
  const eventMap = {
    viewed: CONVERSION_EVENTS.AI_TEASER_VIEWED,
    clicked: CONVERSION_EVENTS.AI_UNLOCK_CLICKED,
    used: CONVERSION_EVENTS.AI_ANALYSIS_GENERATED,
  };
  
  trackConversionEvent(eventMap[action], {
    ...properties,
    feature_name: featureName,
  });
}