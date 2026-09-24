import { SubscriptionDAL } from "@/dal/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { getPermissionLevelFromPlan } from "@/lib/constants/navigation";
import type { PermissionLevel } from "@/types";

// Feature names must match the DB check constraint on ai_feature_usage.feature_name
export type AIFeatureType = "resume_analysis" | "job_fit_analysis" | "cover_letter" | "interview_prep" | "career_advice";

export interface AIFeatureAllowance {
  canUse: boolean;
  usedCount: number;
  allowedCount: number;
  requiresUpgrade: boolean;
}

/**
 * AI Feature Usage Service
 * Manages free tier usage tracking for AI features
 *
 * Free tier: 1 free try of each AI feature
 * Premium: Unlimited usage
 *
 * The ai_feature_usage table stores one row per user/feature/day
 * with a usage_count that increments on each use.
 */
export class AIFeatureUsageService {
  /**
   * Resolve a user's permission tier from their live subscription.
   *
   * Deliberately NOT read from a `users.subscription_tier` column: `public.users` does
   * not exist in production, so every such query errored. A user with no
   * `user_subscriptions` row is the NORMAL case (`handle_new_user_subscription()` is
   * wired to no trigger, so most users have none) and means free tier.
   *
   * @returns the tier, or `null` if the lookup genuinely failed — callers must fail closed.
   */
  static async getSubscriptionTier(userId: string): Promise<PermissionLevel | null> {
    try {
      const subscription = await new SubscriptionDAL().getSubscriptionWithPlanName(userId);
      return getPermissionLevelFromPlan(subscription?.plan_name);
    } catch (error) {
      console.error("Error resolving subscription tier:", error);
      return null;
    }
  }

  /**
   * Check if user can use an AI feature
   * Returns usage allowance and whether upgrade is needed
   */
  static async checkAllowance(
    userId: string,
    featureType: AIFeatureType
  ): Promise<AIFeatureAllowance> {
    const supabase = await createClient();

    const subscriptionTier = await this.getSubscriptionTier(userId);

    if (subscriptionTier === null) {
      // A genuine query failure (not "no row"). Fail closed on the free-tier allowance
      // so a database outage cannot be used to mint unlimited AI calls.
      return {
        canUse: false,
        usedCount: 0,
        allowedCount: 0,
        requiresUpgrade: false,
      };
    }

    // AI Coach tier gets unlimited access
    if (subscriptionTier === "ai_coach") {
      return {
        canUse: true,
        usedCount: 0,
        allowedCount: 999,
        requiresUpgrade: false,
      };
    }

    // Career advice is AI Coach only (no free tier)
    if (featureType === "career_advice") {
      return {
        canUse: false,
        usedCount: 0,
        allowedCount: 0,
        requiresUpgrade: true,
      };
    }

    // Check free tier usage count
    const { data: usageData, error: usageError } = await supabase
      .from("ai_feature_usage")
      .select("usage_count")
      .eq("user_id", userId)
      .eq("feature_name", featureType);

    const usedCount = usageError ? 0 : (usageData || []).reduce((sum, r) => sum + (r.usage_count || 0), 0);
    const allowedCount = subscriptionTier === "free" ? 1 : 999;
    const canUse = usedCount < allowedCount;

    return {
      canUse,
      usedCount,
      allowedCount,
      requiresUpgrade: !canUse && subscriptionTier === "free",
    };
  }

  /**
   * Track AI feature usage
   * Upserts a row per user/feature/day, incrementing usage_count
   */
  static async trackUsage(
    userId: string,
    featureType: AIFeatureType,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase.rpc("track_ai_feature_usage", {
      p_user_id: userId,
      p_feature_name: featureType,
    });

    if (error) {
      console.error("Error tracking AI feature usage:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Get all feature allowances for a user
   * Useful for showing remaining tries in UI
   */
  static async getAllAllowances(userId: string): Promise<Record<AIFeatureType, AIFeatureAllowance>> {
    const features: AIFeatureType[] = ["resume_analysis", "job_fit_analysis", "cover_letter", "interview_prep"];

    const allowances = await Promise.all(
      features.map(async (feature) => ({
        feature,
        allowance: await this.checkAllowance(userId, feature),
      }))
    );

    return allowances.reduce((acc, { feature, allowance }) => {
      acc[feature] = allowance;
      return acc;
    }, {} as Record<AIFeatureType, AIFeatureAllowance>);
  }

  /**
   * Check if user has any free tries remaining
   */
  static async hasAnyFreeTries(userId: string): Promise<boolean> {
    const allowances = await this.getAllAllowances(userId);
    return Object.values(allowances).some((allowance) => allowance.canUse);
  }
}
