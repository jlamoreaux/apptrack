import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
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
          email,
          errorMessage: error.message
        }
      });
      return NextResponse.json(
        { error: error.message || "Failed to resend confirmation email" },
        { status: 400 }
      );
    }

    loggerService.info('Confirmation email resent', {
      category: LogCategory.AUTH,
      action: 'confirmation_email_resent',
      duration: Date.now() - startTime,
      metadata: {
        email
      }
    });

    return NextResponse.json({ success: true });
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