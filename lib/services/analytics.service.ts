import { track } from '@vercel/analytics';
import posthog from 'posthog-js';

// Server-side PostHog initialization would go here if needed
// For now, we'll keep PostHog client-side but controlled

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
}

export interface UserIdentification {
  userId: string;
  properties?: Record<string, any>;
}

export class AnalyticsService {
  private isClientSide = typeof window !== 'undefined';

  /**
   * Track an event to all analytics providers
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Always track to Vercel Analytics (works server and client side)
      track(event.name, event.properties || {});

      // Track to PostHog only on client side
      if (this.isClientSide && posthog?.capture) {
        posthog.capture(event.name, {
          ...event.properties,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  /**
   * Identify a user (PostHog only, client-side)
   */
  async identifyUser(identification: UserIdentification): Promise<void> {
    try {
      if (this.isClientSide && posthog?.identify) {
        posthog.identify(identification.userId, identification.properties);
      }
    } catch (error) {
      console.warn('User identification failed:', error);
    }
  }

  /**
   * Set user properties (PostHog only, client-side)
   */
  async setUserProperties(properties: Record<string, any>): Promise<void> {
    try {
      if (this.isClientSide && posthog?.setPersonProperties) {
        posthog.setPersonProperties(properties);
      }
    } catch (error) {
      console.warn('Setting user properties failed:', error);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(url?: string): Promise<void> {
    try {
      if (this.isClientSide && posthog?.capture) {
        posthog.capture('$pageview', {
          $current_url: url || window.location.href,
        });
      }
    } catch (error) {
      console.warn('Page view tracking failed:', error);
    }
  }

  /**
   * Get feature flags (PostHog only, client-side)
   */
  getFeatureFlags(): Record<string, any> {
    try {
      if (this.isClientSide && posthog?.getFeatureFlags) {
        return posthog.getFeatureFlags();
      }
      return {};
    } catch (error) {
      console.warn('Getting feature flags failed:', error);
      return {};
    }
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();