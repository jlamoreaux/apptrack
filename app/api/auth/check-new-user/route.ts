import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isNewUser } from "@/lib/utils/user-onboarding";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Check new user missing user ID', {
        category: LogCategory.API,
        action: 'check_new_user_missing_id',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const needsOnboarding = await isNewUser(user.id);
    
    loggerService.info('New user status checked', {
      category: LogCategory.BUSINESS,
      userId: user.id,
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
