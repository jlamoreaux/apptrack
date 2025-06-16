"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import type {
  SubscriptionPlan,
  UserSubscription,
  UsageTracking,
} from "@/lib/supabase";

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
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Subscription fetch timeout")), 8000)
      );

      // Fetch current subscription
      const subPromise = supabase
        .from("user_subscriptions")
        .select(
          `
          *,
          subscription_plans (*)
        `
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      const { data: subData, error: subError } = (await Promise.race([
        subPromise,
        timeoutPromise,
      ])) as any;

      if (subError && subError.code !== "PGRST116") {
        console.error("Error fetching subscription:", subError);
      } else {
        setSubscription(subData);
      }

      // Fetch usage data
      const usagePromise = supabase
        .from("usage_tracking")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: usageData, error: usageError } = (await Promise.race([
        usagePromise,
        timeoutPromise,
      ])) as any;

      if (usageError && usageError.code !== "PGRST116") {
        console.error("Error fetching usage:", usageError);
      } else {
        setUsage(usageData);
      }
    } catch (error) {
      console.error("Error fetching subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_monthly");

      if (error) {
        console.error("Error fetching plans:", error);
      } else {
        setPlans(data || []);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const canAddApplication = () => {
    // If no subscription data loaded yet, default to free plan behavior
    if (!subscription) {
      if (!usage) return true; // Allow if usage not loaded yet
      return usage.applications_count < 5; // Free plan limit
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

    const maxApps = subscription.subscription_plans?.max_applications || 5;
    if (maxApps === -1 || maxApps === null) return 0; // Unlimited
    return Math.min((usage.applications_count / maxApps) * 100, 100);
  };

  const getRemainingApplications = () => {
    if (!subscription) {
      // No subscription = free plan
      if (!usage) return 5;
      return Math.max(0, 5 - usage.applications_count);
    }

    if (!usage) return -1; // Unknown

    const maxApps = subscription.subscription_plans?.max_applications;
    if (maxApps === -1 || maxApps === null) return -1; // Unlimited
    return Math.max(0, (maxApps || 0) - usage.applications_count);
  };

  const isOnFreePlan = () => {
    if (!subscription) return true;
    return subscription.subscription_plans?.name === "Free";
  };

  const isOnProPlan = () => {
    if (!subscription) return false;
    return subscription.subscription_plans?.name === "Pro";
  };

  return {
    subscription,
    usage,
    plans,
    loading,
    canAddApplication,
    getUsagePercentage,
    getRemainingApplications,
    isOnFreePlan,
    isOnProPlan,
    refetch: fetchSubscriptionData,
  };
}
