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

// Analytics wrapper for error handling
function safeTrack(eventName: string, properties: Record<string, any>) {
  try {
    track(eventName, properties);
  } catch (error) {
    // Silently fail - don't break user experience for analytics
    console.warn('Analytics tracking failed:', error);
  }
}