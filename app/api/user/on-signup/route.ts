import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { handleOnSignup } from "@/lib/services/on-signup.service";

/**
 * Unified post-signup endpoint that handles:
 * 1. Stripe customer creation (if not exists)
 * 2. Resend audience membership (if not exists)
 *
 * This endpoint is idempotent - safe to call multiple times.
 * All operations are non-blocking to avoid disrupting the user flow.
 *
 * Note: This endpoint requires cookie-based authentication. For internal
 * server-to-server calls (like from auth callbacks), use the handleOnSignup
 * service function directly with the user object.
 */
export async function POST(_request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized on-signup attempt', {
        category: LogCategory.AUTH,
        action: 'on_signup_unauthorized'
      });

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!user.email) {
      loggerService.warn('User missing email in on-signup', {
        category: LogCategory.AUTH,
        action: 'on_signup_missing_email',
        userId: user.id
      });

      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const results = await handleOnSignup(user);

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    loggerService.error('On-signup processing failed', error as Error, {
      category: LogCategory.AUTH,
      action: 'on_signup_error'
    });

    return NextResponse.json(
      { error: "Failed to complete signup setup" },
      { status: 500 }
    );
  }
}
