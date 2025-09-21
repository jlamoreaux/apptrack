import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const flowId = searchParams.get('flowId');
    
    if (!flowId) {
      return NextResponse.json(
        { error: "Flow ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's onboarding progress
    const { data, error } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .eq('flow_id', flowId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading onboarding progress:', error);
      return NextResponse.json(
        { error: "Failed to load progress" },
        { status: 500 }
      );
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error("Error loading onboarding progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface OnboardingProgressRequest {
  flowId: string;
  flowVersion: number;
  currentStepIndex: number;
  completedSteps?: string[];
  skippedSteps?: string[];
  dismissed?: boolean;
  completedAt?: Date;
  startedAt?: Date;
}

export async function POST(request: NextRequest) {
  try {
    const body: OnboardingProgressRequest = await request.json();
    const { flowId, flowVersion, currentStepIndex, completedSteps, skippedSteps, dismissed, completedAt } = body;

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const progressData = {
      user_id: user.id,
      flow_id: flowId,
      flow_version: flowVersion,
      current_step_index: currentStepIndex,
      completed_steps: completedSteps || [],
      skipped_steps: skippedSteps || [],
      dismissed,
      completed_at: completedAt,
    };

    const { data, error } = await supabase
      .from('user_onboarding')
      .upsert(progressData, {
        onConflict: 'user_id,flow_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving onboarding progress:', error);
      return NextResponse.json(
        { error: "Failed to save progress" },
        { status: 500 }
      );
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error("Error saving onboarding progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}