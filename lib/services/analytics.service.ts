import { track } from '@vercel/analytics';
import posthog from 'posthog-js';

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
   * Sanitize properties for Vercel Analytics
   * Vercel only accepts strings, numbers, booleans, and null
   */
  private sanitizeForVercel(properties: Record<string, any>): Record<string, string | number | boolean | null> {
    const sanitized: Record<string, string | number | boolean | null> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) {
        sanitized[key] = null;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (typeof value === 'object') {
        // Convert objects to JSON strings
        try {
          sanitized[key] = JSON.stringify(value);
        } catch {
          sanitized[key] = '[Object]';
        }
      } else {
        // Convert other types to strings
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Track an event to all analytics providers
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Track to Vercel Analytics (client-side only)
      if (this.isClientSide && event.properties) {
        const sanitizedProperties = this.sanitizeForVercel(event.properties);
        track(event.name, sanitizedProperties);
      } else if (this.isClientSide) {
        track(event.name);
      }

      // Track to PostHog only on client side (PostHog accepts any data type)
      if (this.isClientSide && posthog?.capture) {
        posthog.capture(event.name, {
          ...event.properties,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
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
      return {};
    }
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();