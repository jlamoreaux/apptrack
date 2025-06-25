import { createClient } from "@/lib/supabase/server";
import {
  hasApiPermission,
  hasUIPermission,
  canAccessFeature,
} from "@/lib/constants/permissions";
import { PLAN_NAMES } from "@/lib/constants/plans";
import { PermissionServiceError } from "@/services/base";

export interface PermissionCheckResult {
  allowed: boolean;
  userPlan: string;
  requiredPlan?: string;
  message?: string;
}

export class PermissionMiddleware {
  /**
   * Check if a user has permission to access an API endpoint
   */
  static async checkApiPermission(
    userId: string,
    endpoint: keyof typeof import("@/lib/constants/permissions").API_PERMISSIONS.AI_COACH
  ): Promise<PermissionCheckResult> {
    try {
      const supabase = await createClient();

      // Get user's current subscription
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("plan_name, status")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get user subscription: ${error.message}`);
      }

      const userPlan = subscription?.plan_name || PLAN_NAMES.FREE;
      const allowed = hasApiPermission(userPlan, endpoint);

      return {
        allowed,
        userPlan,
        requiredPlan: allowed ? undefined : PLAN_NAMES.AI_COACH,
        message: allowed
          ? undefined
          : "AI Coach features require an AI Coach subscription",
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
   * Check if a user has permission to access a UI feature
   */
  static async checkUIPermission(
    userId: string,
    section: keyof typeof import("@/lib/constants/permissions").UI_PERMISSIONS.DASHBOARD
  ): Promise<PermissionCheckResult> {
    try {
      const supabase = await createClient();

      // Get user's current subscription
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("plan_name, status")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get user subscription: ${error.message}`);
      }

      const userPlan = subscription?.plan_name || PLAN_NAMES.FREE;
      const allowed = hasUIPermission(userPlan, section);

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
   * Check if a user has access to a specific feature
   */
  static async checkFeatureAccess(
    userId: string,
    feature: string
  ): Promise<PermissionCheckResult> {
    try {
      const supabase = await createClient();

      // Get user's current subscription
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("plan_name, status")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get user subscription: ${error.message}`);
      }

      const userPlan = subscription?.plan_name || PLAN_NAMES.FREE;
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
    try {
      const supabase = await createClient();

      // Get user's current subscription
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("plan_name, status")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get user subscription: ${error.message}`);
      }

      const plan = subscription?.plan_name || PLAN_NAMES.FREE;
      const status = subscription?.status || "none";
      const isActive =
        subscription?.status === "active" ||
        subscription?.status === "trialing";
      const isAICoach = plan === PLAN_NAMES.AI_COACH;
      const isPro = plan === PLAN_NAMES.PRO;
      const isFree = plan === PLAN_NAMES.FREE;

      return {
        plan,
        status,
        isActive,
        isAICoach,
        isPro,
        isFree,
      };
    } catch (error) {
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
}
