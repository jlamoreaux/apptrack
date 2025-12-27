import { createClient } from "@/lib/supabase/server";

export type AIFeatureType = "resume_analysis" | "job_fit" | "cover_letter" | "interview_prep";

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
 */
export class AIFeatureUsageService {
  /**
   * Check if user can use an AI feature
   * Returns usage allowance and whether upgrade is needed
   */
  static async checkAllowance(
    userId: string,
    featureType: AIFeatureType
  ): Promise<AIFeatureAllowance> {
    const supabase = await createClient();

    // Call the database function that checks allowance
    const { data, error } = await supabase.rpc("check_ai_feature_allowance", {
      p_user_id: userId,
      p_feature_type: featureType,
    });

    if (error) {
      console.error("Error checking AI feature allowance:", error);
      // On error, deny access to be safe
      return {
        canUse: false,
        usedCount: 0,
        allowedCount: 1,
        requiresUpgrade: true,
      };
    }

    // The function returns a single row with can_use boolean
    const canUse = data as boolean;

    // Get usage count to show user
    const { data: usageData, error: usageError } = await supabase
      .from("ai_feature_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("feature_type", featureType);

    const usedCount = usageError ? 0 : (usageData?.length || 0);

    // Check user's subscription tier
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    const subscriptionTier = userError ? "free" : (userData?.subscription_tier || "free");
    const allowedCount = subscriptionTier === "free" ? 1 : 999; // Premium gets "unlimited"

    return {
      canUse,
      usedCount,
      allowedCount,
      requiresUpgrade: !canUse && subscriptionTier === "free",
    };
  }

  /**
   * Track AI feature usage
   * Records that user has used a feature
   */
  static async trackUsage(
    userId: string,
    featureType: AIFeatureType,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Insert usage record
    const { error } = await supabase.from("ai_feature_usage").insert({
      user_id: userId,
      feature_type: featureType,
      metadata: metadata || {},
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
    const features: AIFeatureType[] = ["resume_analysis", "job_fit", "cover_letter", "interview_prep"];

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
