import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { markOnboardingComplete } from "@/lib/utils/user-onboarding";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized onboarding completion attempt', {
        category: LogCategory.AUTH,
        action: 'onboarding_complete_unauthorized'
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    await markOnboardingComplete(user.id);
    
    loggerService.info('User completed onboarding', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'onboarding_completed',
      duration: Date.now() - startTime
    });
    
    loggerService.logBusinessMetric(
      'onboarding_completed',
      1,
      'count',
      {
        userId: user.id
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('Error marking onboarding complete', error, {
      category: LogCategory.AUTH,
      userId: user?.id,
      action: 'onboarding_complete_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}