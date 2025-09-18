'use client'

/**
 * Client-side analytics utility that calls backend API routes
 * This ensures all external service calls go through our API layer
 */

export interface TrackEventParams {
  eventName: string;
  properties?: Record<string, any>;
  requireAuth?: boolean;
}

export interface IdentifyUserParams {
  properties?: Record<string, any>;
}

export class ClientAnalytics {
  /**
   * Track an event via API route
   */
  async trackEvent({ eventName, properties, requireAuth = false }: TrackEventParams): Promise<boolean> {
    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName,
          properties: {
            ...properties,
            timestamp: new Date().toISOString(),
          },
          requireAuth,
        }),
      });

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Identify current user via API route
   */
  async identifyUser({ properties }: IdentifyUserParams = {}): Promise<boolean> {
    try {
      const response = await fetch('/api/analytics/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties,
        }),
      });

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Convenience methods for common events
  async trackUserSignIn(provider?: string): Promise<boolean> {
    return this.trackEvent({
      eventName: 'user_signed_in',
      properties: { provider: provider || 'email' },
      requireAuth: true,
    });
  }

  async trackUserSignOut(): Promise<boolean> {
    return this.trackEvent({
      eventName: 'user_signed_out',
    });
  }

  async trackApplicationCreated(properties?: { company?: string; role?: string; source?: string }): Promise<boolean> {
    return this.trackEvent({
      eventName: 'application_created',
      properties,
      requireAuth: true,
    });
  }

  async trackApplicationViewed(applicationId: string): Promise<boolean> {
    return this.trackEvent({
      eventName: 'application_viewed',
      properties: { application_id: applicationId },
      requireAuth: true,
    });
  }

  async trackAIFeatureUsed(featureType: string, properties?: Record<string, any>): Promise<boolean> {
    return this.trackEvent({
      eventName: 'ai_feature_used',
      properties: {
        feature_type: featureType,
        ...properties,
      },
      requireAuth: true,
    });
  }

  async trackPageView(page: string, properties?: Record<string, any>): Promise<boolean> {
    return this.trackEvent({
      eventName: 'page_viewed',
      properties: {
        page,
        ...properties,
      },
    });
  }

  async trackUpgradeViewed(source?: string): Promise<boolean> {
    return this.trackEvent({
      eventName: 'upgrade_page_viewed',
      properties: { source },
      requireAuth: true,
    });
  }

  async trackCheckoutStarted(plan?: string): Promise<boolean> {
    return this.trackEvent({
      eventName: 'checkout_started',
      properties: { plan },
      requireAuth: true,
    });
  }
}

// Singleton instance
export const clientAnalytics = new ClientAnalytics();