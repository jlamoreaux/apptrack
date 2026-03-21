"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrialBudgetState } from "@/types";
import { TRIAL_BUDGET } from "@/lib/constants/ai-limits";

const DEFAULT_STATE: TrialBudgetState = {
  analyses_used: 0,
  analyses_limit: TRIAL_BUDGET.LIMIT,
  analyses_remaining: TRIAL_BUDGET.LIMIT,
  is_pro: false,
  onboarding_completed: false,
};

/**
 * Hook to fetch and manage the user's trial budget state.
 * Provides the current budget, a refresh function, and loading state.
 */
export function useTrialBudget() {
  const [budget, setBudget] = useState<TrialBudgetState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-coach/trial-budget");
      if (res.ok) {
        const data: TrialBudgetState = await res.json();
        setBudget(data);
      }
    } catch {
      // Keep current state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completeOnboarding = useCallback(async () => {
    try {
      await fetch("/api/ai-coach/trial-budget", { method: "POST" });
      setBudget((prev) => ({ ...prev, onboarding_completed: true }));
    } catch {
      // Silently fail — onboarding state is non-critical
    }
  }, []);

  return { budget, loading, refresh, completeOnboarding };
}
