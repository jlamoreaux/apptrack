import { createClient } from "@/lib/supabase/server";
import {
  hasApiPermission,
  hasUIPermission,
  canAccessFeature,
} from "@/lib/constants/permissions";
import { PLAN_NAMES } from "@/lib/constants/plans";
import { PermissionServiceError } from "@/services/base";
import {
  isOnProOrHigher,
  isOnAICoachPlan,
  isOnFreePlan,
} from "@/lib/utils/plan-helpers";
import { getSubscription } from "@/lib/supabase/queries";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { AIFeatureUsageService, type AIFeatureType } from "@/lib/services/ai-feature-usage.service";

export interface PermissionCheckResult {
  allowed: boolean;
  userPlan: string;
  requiredPlan?: string;
  message?: string;
  reason?: string;
  usedFreeTier?: boolean;
  remainingFreeTries?: number;
}

export class PermissionMiddleware {
  /**
   * Check if a user has permission to access an API endpoint
   */
  static async checkApiPermission(
    userId: string,
    endpoint: keyof typeof import("@/lib/constants/permissions").API_PERMISSIONS.AI_COACH
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now();
    try {
      const subscription = await getSubscription(userId);
      const userPlan =
        subscription?.subscription_plans?.name || PLAN_NAMES.FREE;
      const allowed = hasApiPermission(userPlan, endpoint);

      const result = {
        allowed,
        userPlan,
        requiredPlan: allowed ? undefined : PLAN_NAMES.AI_COACH,
        message: allowed
          ? undefined
          : "AI Coach features require an AI Coach subscription",
      };

      loggerService.debug(`API permission check: ${endpoint}`, {
        category: LogCategory.AUTH,
        userId,
        action: 'api_permission_check',
        duration: Date.now() - startTime,
        metadata: {
          endpoint,
          userPlan,
          allowed,
          requiredPlan: result.requiredPlan
        }
      });

      if (!allowed) {
        loggerService.warn(`API permission denied: ${endpoint}`, {
          category: LogCategory.SECURITY,
          userId,
          action: 'permission_denied',
          metadata: {
            endpoint,
            userPlan,
            requiredPlan: PLAN_NAMES.AI_COACH,
            type: 'api'
          }
        });
      }

      return result;
    } catch (error) {
      loggerService.error('Permission check failed', error, {
        category: LogCategory.AUTH,
        userId,
        action: 'permission_check_error',
        metadata: {
          endpoint,
          type: 'api'
        }
      });

      throw new PermissionServiceError(
        `Permission check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if a user has permission to access a UI feature
   */
  static async checkUIPermission(
    userId: string,
    section: keyof typeof import("@/lib/constants/permissions").UI_PERMISSIONS.DASHBOARD
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now();
    try {
      const subscription = await getSubscription(userId);
      const userPlan =
        subscription?.subscription_plans?.name || PLAN_NAMES.FREE;
      const allowed = hasUIPermission(userPlan, section);

      const result = {
        allowed,
        userPlan,
        requiredPlan: allowed ? undefined : PLAN_NAMES.AI_COACH,
        message: allowed
          ? undefined
          : "This feature requires an AI Coach subscription",
      };

      loggerService.debug(`UI permission check: ${section}`, {
        category: LogCategory.AUTH,
        userId,
        action: 'ui_permission_check',
        duration: Date.now() - startTime,
        metadata: {
          section,
          userPlan,
          allowed,
          requiredPlan: result.requiredPlan
        }
      });

      if (!allowed) {
        loggerService.info(`UI permission denied: ${section}`, {
          category: LogCategory.SECURITY,
          userId,
          action: 'permission_denied',
          metadata: {
            section,
            userPlan,
            requiredPlan: PLAN_NAMES.AI_COACH,
            type: 'ui'
          }
        });
      }

      return result;
    } catch (error) {
      loggerService.error('UI permission check failed', error, {
        category: LogCategory.AUTH,
        userId,
        action: 'permission_check_error',
        metadata: {
          section,
          type: 'ui'
        }
      });

      throw new PermissionServiceError(
        `Permission check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if a user has access to a specific feature
   */
  static async checkFeatureAccess(
    userId: string,
    feature: string
  ): Promise<PermissionCheckResult> {
    try {
      const subscription = await getSubscription(userId);
      const userPlan =
        subscription?.subscription_plans?.name || PLAN_NAMES.FREE;
      const allowed = canAccessFeature(userPlan, feature);

      return {
        allowed,
        userPlan,
        requiredPlan: allowed ? undefined : PLAN_NAMES.AI_COACH,
        message: allowed
          ? undefined
          : "This feature requires an AI Coach subscription",
      };
    } catch (error) {
      throw new PermissionServiceError(
        `Permission check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get user's current plan and subscription status
   */
  static async getUserPlanInfo(userId: string): Promise<{
    plan: string;
    status: string;
    isActive: boolean;
    isAICoach: boolean;
    isPro: boolean;
    isFree: boolean;
  }> {
    const startTime = Date.now();
    try {
      const subscription = await getSubscription(userId);
      const plan = subscription?.subscription_plans?.name || PLAN_NAMES.FREE;
      const status = subscription?.status || "none";
      const isActive =
        subscription?.status === "active" ||
        subscription?.status === "trialing";
      const isAICoach = isOnAICoachPlan(plan);
      const isPro = isOnProOrHigher(plan);
      const isFree = isOnFreePlan(plan);

      const planInfo = {
        plan,
        status,
        isActive,
        isAICoach,
        isPro,
        isFree,
      };

      loggerService.debug('Retrieved user plan info', {
        category: LogCategory.AUTH,
        userId,
        action: 'get_plan_info',
        duration: Date.now() - startTime,
        metadata: planInfo
      });

      return planInfo;
    } catch (error) {
      loggerService.error('Failed to get user plan info', error, {
        category: LogCategory.AUTH,
        userId,
        action: 'get_plan_info_error'
      });

      throw new PermissionServiceError(
        `Failed to get user plan info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Require AI Coach subscription - throws error if user doesn't have it
   */
  static async requireAICoach(userId: string): Promise<void> {
    const result = await this.getUserPlanInfo(userId);

    if (!result.isAICoach) {
      loggerService.warn('AI Coach subscription required', {
        category: LogCategory.SECURITY,
        userId,
        action: 'subscription_required',
        metadata: {
          requiredPlan: PLAN_NAMES.AI_COACH,
          currentPlan: result.plan,
          type: 'ai_coach'
        }
      });

      throw new PermissionServiceError(
        "AI Coach features require an AI Coach subscription"
      );
    }
  }

  /**
   * Require Pro or higher subscription - throws error if user doesn't have it
   */
  static async requireProOrHigher(userId: string): Promise<void> {
    const result = await this.getUserPlanInfo(userId);

    if (!result.isPro && !result.isAICoach) {
      throw new PermissionServiceError(
        "This feature requires a Pro or AI Coach subscription"
      );
    }
  }

  /**
   * Require active subscription - throws error if user doesn't have one
   */
  static async requireActiveSubscription(userId: string): Promise<void> {
    const result = await this.getUserPlanInfo(userId);

    if (!result.isActive) {
      throw new PermissionServiceError(
        "This feature requires an active subscription"
      );
    }
  }

  /**
   * Check API permission with free tier support
   * Allows free users to use AI features if they have free tries remaining
   *
   * @param userId - User ID
   * @param endpoint - API endpoint to check
   * @param featureType - AI feature type for usage tracking
   * @returns Permission check result with free tier info
   */
  static async checkApiPermissionWithFreeTier(
    userId: string,
    endpoint: keyof typeof import("@/lib/constants/permissions").API_PERMISSIONS.AI_COACH,
    featureType: AIFeatureType
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now();

    try {
      // First check subscription-based permission
      const subscription = await getSubscription(userId);
      const userPlan = subscription?.subscription_plans?.name || PLAN_NAMES.FREE;
      const hasSubscription = hasApiPermission(userPlan, endpoint);

      // If user has subscription, allow immediately
      if (hasSubscription) {
        loggerService.debug(`API permission granted via subscription: ${endpoint}`, {
          category: LogCategory.AUTH,
          userId,
          action: 'api_permission_subscription',
          duration: Date.now() - startTime,
          metadata: { endpoint, userPlan, featureType }
        });

        return {
          allowed: true,
          userPlan,
          reason: 'subscription',
        };
      }

      // Check free tier allowance for free users
      const allowance = await AIFeatureUsageService.checkAllowance(userId, featureType);

      if (allowance.canUse) {
        loggerService.debug(`API permission granted via free tier: ${endpoint}`, {
          category: LogCategory.AUTH,
          userId,
          action: 'api_permission_free_tier',
          duration: Date.now() - startTime,
          metadata: {
            endpoint,
            userPlan,
            featureType,
            usedCount: allowance.usedCount,
            allowedCount: allowance.allowedCount
          }
        });

        return {
          allowed: true,
          userPlan,
          reason: 'free_tier',
          usedFreeTier: true,
          remainingFreeTries: allowance.allowedCount - allowance.usedCount,
        };
      }

      // User has no subscription and no free tries
      loggerService.warn(`API permission denied: ${endpoint}`, {
        category: LogCategory.SECURITY,
        userId,
        action: 'permission_denied',
        metadata: {
          endpoint,
          userPlan,
          featureType,
          reason: 'no_subscription_and_no_free_tries',
          usedCount: allowance.usedCount,
          allowedCount: allowance.allowedCount
        }
      });

      return {
        allowed: false,
        userPlan,
        requiredPlan: PLAN_NAMES.AI_COACH,
        reason: 'free_tier_exhausted',
        message: `You've used your free try of this feature. Upgrade to AI Coach for unlimited access.`,
        usedFreeTier: false,
        remainingFreeTries: 0,
      };

    } catch (error) {
      loggerService.error('Permission check with free tier failed', error, {
        category: LogCategory.AUTH,
        userId,
        action: 'permission_check_error',
        metadata: { endpoint, featureType }
      });

      throw new PermissionServiceError(
        `Permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
