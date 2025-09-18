// Server-side analytics service
// This is specifically for server-side tracking

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
}

export class ServerAnalyticsService {
  /**
   * Track an event on the server side
   * For now, we'll just log it. Vercel Analytics server tracking
   * requires specific setup that may not be available in all environments
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Try to import and use Vercel server analytics if available
      try {
        const { track } = await import('@vercel/analytics/server');
        await track(event.name, event.properties || {});
      } catch (error) {
        // Vercel Analytics might not be available in development
        // or in certain deployment environments
        if (process.env.NODE_ENV === 'production') {
          console.warn('Vercel Analytics server tracking not available');
        }
        
        // Log the event for debugging
        console.log('Analytics Event:', {
          name: event.name,
          properties: event.properties,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn('Server analytics tracking failed:', error);
    }
  }
}

export const serverAnalyticsService = new ServerAnalyticsService();