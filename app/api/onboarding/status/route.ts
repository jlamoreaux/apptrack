import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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
      console.error('Error checking applications:', appError);
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
      console.error('Error checking onboarding:', onboardingError);
      return NextResponse.json(
        { error: "Failed to check onboarding status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasApplications: applications && applications.length > 0,
      applicationsCount: applications?.length || 0,
      hasCompletedOnboarding: !!onboarding?.completed_at,
      onboardingProgress: onboarding,
      shouldStartOnboarding: (!applications || applications.length === 0) && !onboarding?.completed_at
    });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}