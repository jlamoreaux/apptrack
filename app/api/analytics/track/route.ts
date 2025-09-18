import { NextRequest, NextResponse } from "next/server";
import { serverAnalyticsService } from "@/lib/services/analytics-server.service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { eventName, properties, requireAuth = false } = body;

    // Validate required fields
    if (!eventName || typeof eventName !== "string") {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
