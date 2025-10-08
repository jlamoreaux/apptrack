import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

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
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized AI Coach access attempt', {
        category: LogCategory.SECURITY,
        action: 'ai_coach_unauthorized',
        metadata: {
          featureName,
          error: authError?.message
        }
      });
      
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
      loggerService.info('AI Coach access denied - insufficient permissions', {
        category: LogCategory.AUTH,
        userId: user.id,
        action: 'ai_coach_access_denied',
        duration: Date.now() - startTime,
        metadata: {
          featureName,
          userPlan: permissionResult.userPlan,
          requiredPlan: permissionResult.requiredPlan
        }
      });
      
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

    loggerService.debug('AI Coach access granted', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'ai_coach_access_granted',
      duration: Date.now() - startTime,
      metadata: {
        featureName,
        userPlan: permissionResult.userPlan
      }
    });

    // User is authenticated and has AI Coach access
    return {
      authorized: true,
      user,
      userId: user.id
    };
  } catch (error) {
    loggerService.error('AI Coach auth check error', error, {
      category: LogCategory.AUTH,
      action: 'ai_coach_auth_error',
      duration: Date.now() - startTime,
      metadata: {
        featureName
      }
    });
    
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
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.debug('Authentication failed', {
        category: LogCategory.AUTH,
        action: 'authentication_failed',
        duration: Date.now() - startTime,
        metadata: {
          error: authError?.message
        }
      });
      
      return {
        authorized: false,
        response: NextResponse.json(
          { error: ERROR_MESSAGES.UNAUTHORIZED },
          { status: 401 }
        )
      };
    }

    loggerService.debug('Authentication successful', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'authentication_success',
      duration: Date.now() - startTime
    });

    return {
      authorized: true,
      user,
      userId: user.id
    };
  } catch (error) {
    loggerService.error('Authentication check error', error, {
      category: LogCategory.AUTH,
      action: 'authentication_error',
      duration: Date.now() - startTime
    });
    
    return {
      authorized: false,
      response: NextResponse.json(
        { error: ERROR_MESSAGES.UNEXPECTED },
        { status: 500 }
      )
    };
  }
}