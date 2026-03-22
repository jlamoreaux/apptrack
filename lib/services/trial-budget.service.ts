import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { TRIAL_BUDGET } from "@/lib/constants/ai-limits";
import type { AIToolType, TrialBudgetState } from "@/types";

/**
 * Trial Budget Service
 *
 * Manages the one-time budget of 5 free AI analyses shared across
 * Job Fit, Interview Prep, and Cover Letter tools.
 *
 * Uses atomic check-and-decrement via the `consume_ai_analysis` SQL function
 * to prevent race conditions from concurrent submissions.
 */
export class TrialBudgetService {
  /**
   * Get the current trial budget state for a user.
   * Returns budget info regardless of subscription status.
   */
  static async getBudgetState(userId: string): Promise<TrialBudgetState> {
    const supabase = await createClient();

    // Check subscription status
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("status, plan_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .single();

    const isPro = !!sub;

    // Get profile for budget info
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("ai_analyses_used, ai_trial_onboarding_completed")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      // Default to empty budget — don't block paid users on transient errors
      return {
        analyses_used: 0,
        analyses_limit: TRIAL_BUDGET.LIMIT,
        analyses_remaining: isPro ? 999 : TRIAL_BUDGET.LIMIT,
        is_pro: isPro,
        onboarding_completed: false,
      };
    }

    const used = profile.ai_analyses_used ?? 0;
    const remaining = isPro ? 999 : Math.max(TRIAL_BUDGET.LIMIT - used, 0);

    return {
      analyses_used: used,
      analyses_limit: TRIAL_BUDGET.LIMIT,
      analyses_remaining: remaining,
      is_pro: isPro,
      onboarding_completed: profile.ai_trial_onboarding_completed ?? false,
    };
  }

  /**
   * Attempt to consume one analysis from the user's trial budget.
   * Uses atomic SQL to prevent race conditions.
   *
   * Returns { allowed: true, budget } if successful.
   * Returns { allowed: false, budget, reason } if budget exhausted.
   *
   * Pro users always pass — no budget consumed.
   */
  static async consumeAnalysis(
    userId: string,
    toolType: AIToolType
  ): Promise<{
    allowed: boolean;
    budget: TrialBudgetState;
    reason?: "trial_exhausted";
  }> {
    const budget = await this.getBudgetState(userId);

    // Pro users bypass budget entirely
    if (budget.is_pro) {
      return { allowed: true, budget };
    }

    // Atomic check-and-decrement
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("consume_ai_analysis", {
      p_user_id: userId,
      p_limit: TRIAL_BUDGET.LIMIT,
    });

    if (error) {
      console.error("Error consuming AI analysis budget:", error);
      // On DB error, deny to avoid giving away free analyses
      return {
        allowed: false,
        budget,
        reason: "trial_exhausted",
      };
    }

    const newCount = data as number;

    // -1 means budget was already exhausted
    if (newCount === -1) {
      captureServerEvent(userId, "ai_trial_exhausted", { tool_type: toolType });
      return {
        allowed: false,
        budget: { ...budget, analyses_remaining: 0 },
        reason: "trial_exhausted",
      };
    }

    const remaining = TRIAL_BUDGET.LIMIT - newCount;

    captureServerEvent(userId, "ai_trial_analysis_used", {
      analyses_remaining: remaining,
      tool_type: toolType,
    });

    // Fire exhausted event when hitting zero
    if (remaining === 0) {
      captureServerEvent(userId, "ai_trial_exhausted", { tool_type: toolType });
    }

    return {
      allowed: true,
      budget: {
        ...budget,
        analyses_used: newCount,
        analyses_remaining: remaining,
      },
    };
  }

  /**
   * Refund a consumed analysis (e.g., when the AI call fails).
   * Ensures the user isn't penalized for errors outside their control.
   */
  static async refundAnalysis(
    userId: string,
    toolType: AIToolType
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("refund_ai_analysis", {
      p_user_id: userId,
    });

    if (error) {
      console.error("Error refunding AI analysis:", error);
      return;
    }

    captureServerEvent(userId, "ai_trial_analysis_refunded", {
      tool_type: toolType,
      error_reason: "analysis_failed",
    });
  }

  /**
   * Mark the trial onboarding as completed for a user.
   */
  static async completeOnboarding(userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ ai_trial_onboarding_completed: true })
      .eq("id", userId);

    if (error) {
      console.error("Error completing trial onboarding:", error);
      return;
    }

    captureServerEvent(userId, "ai_trial_onboarding_completed");
  }
}
