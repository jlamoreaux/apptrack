import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/redis/client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// Rate limiter: 3 requests per IP per 15 minutes
const rateLimiter = createRateLimiter(3, "15 m");

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check rate limit by IP
    if (rateLimiter) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const result = await rateLimiter.limit(ip);
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    const { email } = await request.json();

    if (!email) {
      loggerService.warn('Resend confirmation missing email', {
        category: LogCategory.API,
        action: 'resend_confirmation_missing_email',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Resend confirmation email
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      loggerService.error('Error resending confirmation email', error, {
        category: LogCategory.AUTH,
        action: 'resend_confirmation_error',
        duration: Date.now() - startTime,
        metadata: {
          errorMessage: error.message
        }
      });
    } else {
      loggerService.info('Confirmation email resent', {
        category: LogCategory.AUTH,
        action: 'confirmation_email_resent',
        duration: Date.now() - startTime,
      });
    }

    // Always return the same response to prevent email enumeration
    return NextResponse.json({
      message: "If this email is registered, you'll receive a confirmation link"
    });
  } catch (error) {
    loggerService.error('Error in resend-confirmation', error, {
      category: LogCategory.API,
      action: 'resend_confirmation_exception',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
