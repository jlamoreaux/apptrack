import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isNewUser } from "@/lib/utils/user-onboarding";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      loggerService.warn('Check new user missing user ID', {
        category: LogCategory.API,
        action: 'check_new_user_missing_id',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    
    const needsOnboarding = await isNewUser(userId);
    
    loggerService.info('New user status checked', {
      category: LogCategory.BUSINESS,
      userId,
      action: 'new_user_status_checked',
      duration: Date.now() - startTime,
      metadata: {
        needsOnboarding
      }
    });
    
    return NextResponse.json({ needsOnboarding });
  } catch (error) {
    loggerService.error('Error checking new user status', error, {
      category: LogCategory.API,
      action: 'check_new_user_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to check user status" },
      { status: 500 }
    );
  }
}