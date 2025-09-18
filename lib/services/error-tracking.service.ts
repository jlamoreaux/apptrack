import { analyticsService } from './analytics.service';

export interface ErrorContext {
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface AppError {
  name: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
}

export class ErrorTrackingService {
  /**
   * Track JavaScript errors
   */
  async trackError(error: Error, context?: ErrorContext): Promise<void> {
    try {
      const errorEvent = {
        name: 'javascript_error',
        properties: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          error_type: 'javascript',
          ...context,
          timestamp: new Date().toISOString(),
        },
      };

      await analyticsService.trackEvent(errorEvent);
    } catch (trackingError) {
    }
  }

  /**
   * Track API errors
   */
  async trackAPIError(
    endpoint: string,
    method: string,
    statusCode: number,
    errorMessage: string,
    context?: ErrorContext
  ): Promise<void> {
    try {
      const errorEvent = {
        name: 'api_error',
        properties: {
          endpoint,
          method,
          status_code: statusCode,
          error_message: errorMessage,
          error_type: 'api',
          ...context,
          timestamp: new Date().toISOString(),
        },
      };

      await analyticsService.trackEvent(errorEvent);
    } catch (trackingError) {
    }
  }

  /**
   * Track React component errors
   */
  async trackComponentError(
    componentName: string,
    error: Error,
    context?: ErrorContext
  ): Promise<void> {
    try {
      const errorEvent = {
        name: 'component_error',
        properties: {
          component_name: componentName,
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          error_type: 'react',
          ...context,
          timestamp: new Date().toISOString(),
        },
      };

      await analyticsService.trackEvent(errorEvent);
    } catch (trackingError) {
    }
  }

  /**
   * Track unhandled promise rejections
   */
  async trackUnhandledRejection(
    reason: any,
    context?: ErrorContext
  ): Promise<void> {
    try {
      const errorEvent = {
        name: 'unhandled_promise_rejection',
        properties: {
          reason: reason?.toString() || 'Unknown reason',
          error_type: 'promise_rejection',
          ...context,
          timestamp: new Date().toISOString(),
        },
      };

      await analyticsService.trackEvent(errorEvent);
    } catch (trackingError) {
    }
  }

  /**
   * Track custom application errors
   */
  async trackCustomError(
    errorName: string,
    errorMessage: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: ErrorContext
  ): Promise<void> {
    try {
      const errorEvent = {
        name: 'custom_error',
        properties: {
          error_name: errorName,
          error_message: errorMessage,
          severity,
          error_type: 'custom',
          ...context,
          timestamp: new Date().toISOString(),
        },
      };

      await analyticsService.trackEvent(errorEvent);
    } catch (trackingError) {
    }
  }

  /**
   * Initialize global error handlers
   */
  initializeGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        url: window.location.href,
        userAgent: navigator.userAgent,
        component: 'global',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackUnhandledRejection(event.reason, {
        url: window.location.href,
        userAgent: navigator.userAgent,
        component: 'global',
      });
    });
  }
}

// Singleton instance
export const errorTrackingService = new ErrorTrackingService();