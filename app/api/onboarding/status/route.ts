import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized onboarding status access', {
        category: LogCategory.SECURITY,
        action: 'onboarding_status_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has any applications
    const { data: applications, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    
    if (appError) {
      loggerService.error('Error checking applications', appError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'onboarding_status_applications_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Failed to check applications" },
        { status: 500 }
      );
    }
    
    // Check if user has completed onboarding
    const { data: onboarding, error: onboardingError } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .eq('flow_id', 'new-user-onboarding')
      .single();
    
    // PGRST116 means no rows found, which is fine
    if (onboardingError && onboardingError.code !== 'PGRST116') {
      loggerService.error('Error checking onboarding', onboardingError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'onboarding_status_check_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Failed to check onboarding status" },
        { status: 500 }
      );
    }

    const hasApplications = applications && applications.length > 0;
    const hasCompletedOnboarding = !!onboarding?.completed_at;
    const shouldStartOnboarding = (!applications || applications.length === 0) && !onboarding?.completed_at;

    loggerService.info('Onboarding status checked', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'onboarding_status_checked',
      duration: Date.now() - startTime,
      metadata: {
        hasApplications,
        applicationsCount: applications?.length || 0,
        hasCompletedOnboarding,
        shouldStartOnboarding
      }
    });

    return NextResponse.json({
      hasApplications,
      applicationsCount: applications?.length || 0,
      hasCompletedOnboarding,
      onboardingProgress: onboarding,
      shouldStartOnboarding
    });
  } catch (error) {
    loggerService.error('Error checking onboarding status', error, {
      category: LogCategory.API,
      action: 'onboarding_status_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}