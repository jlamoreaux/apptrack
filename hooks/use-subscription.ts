"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type {
  SubscriptionPlan,
  UserSubscription,
  UsageTracking,
} from "@/lib/supabase";
import {
  isOnFreePlan,
  isOnProOrHigher,
  isOnAICoachPlan,
} from "@/lib/utils/plan-helpers";
import { PLAN_LIMITS } from "@/lib/constants/plans";

export function useSubscription(userId: string | null) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(
    null
  );
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchSubscriptionData();
      fetchPlans();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchSubscriptionData = async () => {
    if (!userId) return;

    try {
      // Fetch current subscription status
      const response = await fetch(`/api/subscription/check?userId=${userId}`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const { subscription: subscriptionData } = await response.json();
        setSubscription(subscriptionData);
      }

      // Fetch usage data
      const usageResponse = await fetch("/api/subscription/usage", {
        method: "GET", 
        credentials: "include",
      });

      if (usageResponse.ok) {
        const { usage: usageData } = await usageResponse.json();
        setUsage(usageData);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/subscription/plans", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const { plans: plansData } = await response.json();
        setPlans(plansData || []);
      } else {
      }
    } catch (error) {
    }
  };

  const canAddApplication = () => {
    // If no subscription data loaded yet, default to free plan behavior
    if (!subscription) {
      if (!usage) return true; // Allow if usage not loaded yet
      return usage.applications_count < PLAN_LIMITS.FREE_MAX_APPLICATIONS; // Free plan limit
    }

    // If no usage data, allow (will be created on first application)
    if (!usage) {
      return true;
    }

    const maxApps = subscription.subscription_plans?.max_applications;

    // Check for unlimited (Pro plan)
    if (maxApps === -1 || maxApps === null) {
      return true;
    }

    // Check against limit
    const canAdd = Boolean(maxApps && usage.applications_count < maxApps);
    return canAdd;
  };

  const getUsagePercentage = () => {
    if (!subscription || !usage) return 0;

    const maxApps = subscription.subscription_plans?.max_applications || PLAN_LIMITS.FREE_MAX_APPLICATIONS;
    if (maxApps === -1 || maxApps === null) return 0; // Unlimited
    return Math.min((usage.applications_count / maxApps) * 100, 100);
  };

  const getRemainingApplications = () => {
    if (!subscription) {
      // No subscription = free plan
      if (!usage) return PLAN_LIMITS.FREE_MAX_APPLICATIONS;
      return Math.max(0, PLAN_LIMITS.FREE_MAX_APPLICATIONS - usage.applications_count);
    }

    if (!usage) return -1; // Unknown

    const maxApps = subscription.subscription_plans?.max_applications;
    if (maxApps === -1 || maxApps === null) return -1; // Unlimited
    return Math.max(0, (maxApps || 0) - usage.applications_count);
  };

  const checkIsOnFreePlan = () => {
    if (!subscription) return true;
    return isOnFreePlan(subscription.subscription_plans?.name || "Free");
  };

  const checkIsOnProOrHigher = () => {
    if (!subscription) return false;
    return isOnProOrHigher(subscription.subscription_plans?.name || "Free");
  };

  const checkIsOnAICoachPlan = () => {
    if (!subscription) return false;
    return isOnAICoachPlan(subscription.subscription_plans?.name || "Free");
  };

  const hasAICoachAccess = () => {
    return checkIsOnAICoachPlan();
  };

  return {
    subscription,
    usage,
    plans,
    loading,
    canAddApplication,
    getUsagePercentage,
    getRemainingApplications,
    isOnFreePlan: checkIsOnFreePlan,
    isOnProPlan: checkIsOnProOrHigher,
    isOnAICoachPlan: checkIsOnAICoachPlan,
    hasAICoachAccess,
    refetch: fetchSubscriptionData,
  };
}
