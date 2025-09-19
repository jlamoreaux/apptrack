import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export interface AICoachAuthResult {
  authorized: boolean;
  user?: any;
  userId?: string;
  response?: NextResponse;
}

/**
 * Check if user is authenticated and has AI Coach access
 * Returns early response if user is unauthorized or on free tier
 */
export async function checkAICoachAccess(
  featureName: keyof typeof import("@/lib/constants/permissions").API_PERMISSIONS.AI_COACH
): Promise<AICoachAuthResult> {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: ERROR_MESSAGES.UNAUTHORIZED },
          { status: 401 }
        )
      };
    }

    // Check AI Coach subscription
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      featureName
    );

    if (!permissionResult.allowed) {
      return {
        authorized: false,
        user,
        userId: user.id,
        response: NextResponse.json(
          { 
            error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
            userPlan: permissionResult.userPlan,
            requiredPlan: permissionResult.requiredPlan
          },
          { status: 403 }
        )
      };
    }

    // User is authenticated and has AI Coach access
    return {
      authorized: true,
      user,
      userId: user.id
    };
  } catch (error) {
    console.error("AI Coach auth check error:", error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: ERROR_MESSAGES.UNEXPECTED },
        { status: 500 }
      )
    };
  }
}

/**
 * Check if user is authenticated (for endpoints that don't require AI Coach)
 * But still need authentication
 */
export async function checkAuthentication(): Promise<AICoachAuthResult> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: ERROR_MESSAGES.UNAUTHORIZED },
          { status: 401 }
        )
      };
    }

    return {
      authorized: true,
      user,
      userId: user.id
    };
  } catch (error) {
    console.error("Authentication check error:", error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: ERROR_MESSAGES.UNEXPECTED },
        { status: 500 }
      )
    };
  }
}