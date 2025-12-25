import { useEffect, useState } from "react";
import type { AIFeatureType, AIFeatureAllowance } from "@/lib/services/ai-feature-usage.service";

/**
 * Hook to check if authenticated user can use an AI feature
 * Shows remaining free tries and whether upgrade is needed
 */
export function useAIFeatureAllowance(featureType: AIFeatureType) {
  const [allowance, setAllowance] = useState<AIFeatureAllowance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAllowance = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/ai-features/check-allowance?feature=${featureType}`
        );

        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated - that's okay, they might be on try page
            setAllowance(null);
            setIsLoading(false);
            return;
          }
          throw new Error("Failed to check allowance");
        }

        const data = await response.json();
        setAllowance(data);
      } catch (err) {
        console.error("Error checking AI feature allowance:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    checkAllowance();
  }, [featureType]);

  return {
    allowance,
    isLoading,
    error,
    canUse: allowance?.canUse ?? false,
    requiresUpgrade: allowance?.requiresUpgrade ?? false,
    usedCount: allowance?.usedCount ?? 0,
    allowedCount: allowance?.allowedCount ?? 1,
  };
}

/**
 * Hook to get all AI feature allowances
 * Useful for showing a dashboard of remaining tries
 */
export function useAllAIFeatureAllowances() {
  const [allowances, setAllowances] = useState<Record<AIFeatureType, AIFeatureAllowance> | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [hasAnyFreeTries, setHasAnyFreeTries] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllowances = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/ai-features/allowances");

        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated
            setAllowances(null);
            setIsLoading(false);
            return;
          }
          throw new Error("Failed to fetch allowances");
        }

        const data = await response.json();
        setAllowances(data.allowances);
        setSubscriptionTier(data.subscriptionTier);
        setHasAnyFreeTries(data.hasAnyFreeTries);
      } catch (err) {
        console.error("Error fetching AI feature allowances:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllowances();
  }, []);

  return {
    allowances,
    subscriptionTier,
    hasAnyFreeTries,
    isLoading,
    error,
  };
}
