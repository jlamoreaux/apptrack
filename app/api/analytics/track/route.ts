import { NextRequest, NextResponse } from "next/server";
import { serverAnalyticsService } from "@/lib/services/analytics-server.service";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    let { eventName, properties, requireAuth = false } = body;

    // Validate required fields
    if (!eventName || typeof eventName !== "string") {
      loggerService.warn('Analytics track missing or invalid event name', {
        category: LogCategory.API,
        action: 'analytics_track_validation_error',
        duration: Date.now() - startTime,
        metadata: {
          hasEventName: !!eventName,
          eventNameType: typeof eventName
        }
      });
      return NextResponse.json(
        { error: "Event name is required and must be a string" },
        { status: 400 }
      );
    }

    // Check authentication if required
    if (requireAuth) {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        loggerService.warn('Analytics track authentication required but failed', {
          category: LogCategory.SECURITY,
          action: 'analytics_track_auth_failed',
          duration: Date.now() - startTime,
          metadata: { eventName }
        });
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Add user ID to properties if authenticated
      if (properties) {
        properties = { ...properties, user_id: user.id };
      } else {
        properties = { user_id: user.id };
      }
    }

    // Track the event using server-side analytics
    await serverAnalyticsService.trackEvent({
      name: eventName,
      properties: properties || {},
    });

    loggerService.info('Analytics event tracked', {
      category: LogCategory.BUSINESS,
      userId: properties?.user_id,
      action: 'analytics_event_tracked',
      duration: Date.now() - startTime,
      metadata: {
        eventName,
        requireAuth,
        hasProperties: !!properties && Object.keys(properties).length > 0,
        propertyCount: properties ? Object.keys(properties).length : 0
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('Analytics tracking error', error, {
      category: LogCategory.API,
      action: 'analytics_track_error',
      duration: Date.now() - startTime,
      metadata: { eventName }
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
