import { track } from '@vercel/analytics';
import { getPlanDisplayName } from '@/lib/utils/plan-helpers';

// AI Coach Analytics Events
export const AI_COACH_EVENTS = {
  // Navigation Events
  NAVIGATION_VIEWED: 'ai_coach_navigation_viewed',
  FEATURE_CARD_CLICKED: 'ai_coach_feature_clicked',
  UPGRADE_CTA_CLICKED: 'ai_coach_upgrade_clicked',
  
  // Feature Usage Events
  RESUME_ANALYSIS_STARTED: 'ai_coach_resume_analysis_started',
  INTERVIEW_PREP_STARTED: 'ai_coach_interview_prep_started',
  COVER_LETTER_STARTED: 'ai_coach_cover_letter_started',
  CAREER_ADVICE_STARTED: 'ai_coach_career_advice_started',
  JOB_FIT_ANALYSIS_STARTED: 'ai_coach_job_fit_started',
} as const;

// Application Card Analytics Events
export const APPLICATION_CARD_EVENTS = {
  // Card Interactions
  CARD_CLICKED: 'application_card_clicked',
  CARD_HOVERED: 'application_card_hovered',
  EXTERNAL_LINK_CLICKED: 'application_external_link_clicked',
  
  // Navigation Patterns
  LIST_VIEWED: 'application_list_viewed',
  DETAIL_ACCESSED: 'application_detail_accessed',
  
  // Interaction Methods
  KEYBOARD_NAVIGATION: 'application_card_keyboard_nav',
  MOUSE_NAVIGATION: 'application_card_mouse_nav',
} as const;

// Analytics event properties
interface BaseAnalyticsProperties {
  subscription_plan: string;
  user_id?: string;
}

interface FeatureClickProperties extends BaseAnalyticsProperties {
  feature_name: string;
  location: 'navigation' | 'dashboard' | 'application_detail';
}

interface UpgradeClickProperties extends BaseAnalyticsProperties {
  source: 'navigation' | 'feature_gate' | 'dashboard';
}

interface ApplicationCardProperties extends BaseAnalyticsProperties {
  application_id: string;
  company_name: string;
  application_status: string;
  days_since_applied: number;
}

interface CardInteractionProperties extends ApplicationCardProperties {
  interaction_method: 'click' | 'keyboard' | 'hover';
  location: 'dashboard' | 'applications_page' | 'search_results';
  card_position?: number; // Position in list for UX analysis
}

interface ListViewProperties extends BaseAnalyticsProperties {
  total_applications: number;
  displayed_applications: number;
  has_filters_applied: boolean;
  view_type: 'dashboard' | 'full_list' | 'archived';
}

// Analytics tracking functions
export const aiCoachAnalytics = {
  // Track when AI Coach navigation component is viewed
  trackNavigationViewed: (properties: BaseAnalyticsProperties) => {
    safeTrack(AI_COACH_EVENTS.NAVIGATION_VIEWED, {
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track when a feature card is clicked
  trackFeatureCardClick: (properties: FeatureClickProperties) => {
    safeTrack(AI_COACH_EVENTS.FEATURE_CARD_CLICKED, {
      feature_name: properties.feature_name,
      location: properties.location,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track when upgrade CTA is clicked
  trackUpgradeClick: (properties: UpgradeClickProperties) => {
    safeTrack(AI_COACH_EVENTS.UPGRADE_CTA_CLICKED, {
      source: properties.source,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track when AI features are started
  trackFeatureUsage: (eventName: string, properties: BaseAnalyticsProperties & { feature_context?: string }) => {
    safeTrack(eventName, {
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      feature_context: properties.feature_context,
      timestamp: new Date().toISOString(),
    });
  },
};

// Application Card Analytics Functions
export const applicationCardAnalytics = {
  // Track when application card is clicked
  trackCardClick: (properties: CardInteractionProperties) => {
    safeTrack(APPLICATION_CARD_EVENTS.CARD_CLICKED, {
      application_id: properties.application_id,
      company_name: properties.company_name,
      application_status: properties.application_status,
      days_since_applied: properties.days_since_applied,
      interaction_method: properties.interaction_method,
      location: properties.location,
      card_position: properties.card_position,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track when application card is hovered (engagement)
  trackCardHover: (properties: ApplicationCardProperties & { hover_duration_ms: number }) => {
    safeTrack(APPLICATION_CARD_EVENTS.CARD_HOVERED, {
      application_id: properties.application_id,
      company_name: properties.company_name,
      application_status: properties.application_status,
      days_since_applied: properties.days_since_applied,
      hover_duration_ms: properties.hover_duration_ms,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track when external job link is clicked
  trackExternalLinkClick: (properties: ApplicationCardProperties) => {
    safeTrack(APPLICATION_CARD_EVENTS.EXTERNAL_LINK_CLICKED, {
      application_id: properties.application_id,
      company_name: properties.company_name,
      application_status: properties.application_status,
      days_since_applied: properties.days_since_applied,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track when application list is viewed
  trackListView: (properties: ListViewProperties) => {
    safeTrack(APPLICATION_CARD_EVENTS.LIST_VIEWED, {
      total_applications: properties.total_applications,
      displayed_applications: properties.displayed_applications,
      has_filters_applied: properties.has_filters_applied,
      view_type: properties.view_type,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Track successful navigation to application detail
  trackDetailAccess: (properties: ApplicationCardProperties & { navigation_source: string }) => {
    safeTrack(APPLICATION_CARD_EVENTS.DETAIL_ACCESSED, {
      application_id: properties.application_id,
      company_name: properties.company_name,
      application_status: properties.application_status,
      days_since_applied: properties.days_since_applied,
      navigation_source: properties.navigation_source,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
      user_id: properties.user_id,
      timestamp: new Date().toISOString(),
    });
  },

  // Helper to calculate days since applied
  calculateDaysSinceApplied: (dateApplied: string): number => {
    const appliedDate = new Date(dateApplied);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - appliedDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
};

// Analytics wrapper for error handling
export function safeTrack(eventName: string, properties: Record<string, any>) {
  try {
    track(eventName, properties);
  } catch (error) {
    // Silently fail - don't break user experience for analytics
    console.warn('Analytics tracking failed:', error);
  }
}