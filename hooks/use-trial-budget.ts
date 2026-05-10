"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrialBudgetState } from "@/types";
import { TRIAL_BUDGET } from "@/lib/constants/ai-limits";

function isTrialBudgetState(value: unknown): value is TrialBudgetState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.analyses_used === "number" &&
    typeof v.analyses_limit === "number" &&
    typeof v.analyses_remaining === "number" &&
    typeof v.is_pro === "boolean" &&
    typeof v.onboarding_completed === "boolean"
  );
}

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
        const data: unknown = await res.json();
        if (isTrialBudgetState(data)) {
          // Never downgrade onboarding_completed from true→false — the user
          // may have dismissed the modal before the server write committed,
          // and the polling refresh would otherwise flash it back.
          setBudget((prev) => ({
            ...data,
            onboarding_completed: prev.onboarding_completed || data.onboarding_completed,
          }));
        }
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
      const res = await fetch("/api/ai-coach/trial-budget", { method: "POST" });
      if (!res.ok) return;
      setBudget((prev) => ({ ...prev, onboarding_completed: true }));
    } catch {
      // Silently fail — onboarding state is non-critical
    }
  }, []);

  return { budget, loading, refresh, completeOnboarding };
}
