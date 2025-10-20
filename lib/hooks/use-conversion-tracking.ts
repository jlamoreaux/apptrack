"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CONVERSION_EVENTS,
  trackConversionEvent,
  trackFunnelStep,
  trackFeatureEngagement,
  type ConversionEvent,
  type ConversionEventProperties,
} from "@/lib/analytics/conversion-events";

/**
 * Hook for conversion tracking throughout the app
 */
export function useConversionTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views automatically
  useEffect(() => {
    if (!pathname) return;

    // Map pathnames to conversion events
    const pageEventMap: Record<string, ConversionEvent> = {
      "/": CONVERSION_EVENTS.LANDING_PAGE_VIEW,
      "/dashboard": CONVERSION_EVENTS.DASHBOARD_VIEWED,
      "/signup": CONVERSION_EVENTS.SIGNUP_STARTED,
      "/dashboard/upgrade": CONVERSION_EVENTS.UPGRADE_PAGE_VIEWED,
    };

    const event = pageEventMap[pathname];
    if (event) {
      const utmParams: ConversionEventProperties = {};
      
      // Capture UTM parameters
      if (searchParams) {
        ["utm_source", "utm_medium", "utm_campaign"].forEach((param) => {
          const value = searchParams.get(param);
          if (value) {
            utmParams[param as keyof ConversionEventProperties] = value;
          }
        });
      }

      trackConversionEvent(event, {
        page_url: pathname,
        page_name: pathname.split("/").pop() || "home",
        ...utmParams,
      });
    }
  }, [pathname, searchParams]);

  // Track signup completion
  const trackSignupComplete = useCallback((userId: string, email?: string) => {
    trackFunnelStep("LEAD", CONVERSION_EVENTS.SIGNUP_COMPLETED, {
      user_id: userId,
    });
  }, []);

  // Track application additions
  const trackApplicationAdded = useCallback((applicationCount: number) => {
    const properties = { application_count: applicationCount };

    if (applicationCount === 1) {
      trackFunnelStep("ACTIVATED_USER", CONVERSION_EVENTS.FIRST_APPLICATION_ADDED, properties);
    } else if (applicationCount === 3) {
      trackFunnelStep("ACTIVATED_USER", CONVERSION_EVENTS.THIRD_APPLICATION_ADDED, properties);
    } else if (applicationCount === 5) {
      trackConversionEvent(CONVERSION_EVENTS.FIFTH_APPLICATION_ADDED, properties);
    }
  }, []);

  // Track AI feature interactions
  const trackAIFeature = useCallback((
    featureName: string,
    action: "viewed" | "clicked" | "used",
    location?: string
  ) => {
    trackFeatureEngagement(featureName, action, {
      feature_location: location,
    });
  }, []);

  // Track upgrade flow
  const trackUpgradeStep = useCallback((
    step: "initiated" | "viewed" | "payment_entered" | "completed",
    planName?: string
  ) => {
    const stepMap = {
      initiated: CONVERSION_EVENTS.UPGRADE_INITIATED,
      viewed: CONVERSION_EVENTS.UPGRADE_PAGE_VIEWED,
      payment_entered: CONVERSION_EVENTS.PAYMENT_METHOD_ENTERED,
      completed: CONVERSION_EVENTS.UPGRADE_COMPLETED,
    };

    const funnelStep = step === "completed" ? "CUSTOMER" : "QUALIFIED_LEAD";
    
    trackFunnelStep(funnelStep, stepMap[step], {
      plan_name: planName,
    });
  }, []);

  // Track referral actions
  const trackReferralAction = useCallback((
    action: "copied" | "shared" | "visited" | "signup_started" | "signup_completed",
    referralCode?: string
  ) => {
    const actionMap = {
      copied: CONVERSION_EVENTS.REFERRAL_LINK_COPIED,
      shared: CONVERSION_EVENTS.REFERRAL_LINK_SHARED,
      visited: CONVERSION_EVENTS.REFERRAL_PAGE_VISITED,
      signup_started: CONVERSION_EVENTS.REFERRAL_SIGNUP_STARTED,
      signup_completed: CONVERSION_EVENTS.REFERRAL_SIGNUP_COMPLETED,
    };

    trackConversionEvent(actionMap[action], {
      referral_code: referralCode,
    });
  }, []);

  return {
    trackSignupComplete,
    trackApplicationAdded,
    trackAIFeature,
    trackUpgradeStep,
    trackReferralAction,
    // Export raw tracking function for custom events
    trackEvent: trackConversionEvent,
  };
}