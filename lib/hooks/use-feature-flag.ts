"use client";

import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";

/**
 * Feature flags available in the application
 */
export const FEATURE_FLAGS = {
  // Conversion optimization experiments
  CONVERSION_HERO_COPY: "conversion-hero-copy",
  PRICING_STRUCTURE_V2: "pricing-structure-v2",
  AI_TEASER_DESIGN: "ai-teaser-design",
  REFERRAL_PROGRAM_BETA: "referral-program-beta",
  
  // Other feature flags
  EXIT_INTENT_POPUP: "exit-intent-popup",
  ONBOARDING_V2: "onboarding-v2",
  ENHANCED_ANALYTICS: "enhanced-analytics",
  SHOW_TESTIMONIALS: "show-testimonials",
} as const;

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

/**
 * Hook to check if a feature flag is enabled
 * @param flagName - The name of the feature flag to check
 * @param fallback - Fallback value if PostHog is not available (default: false)
 * @returns boolean indicating if the feature is enabled
 */
export function useFeatureFlag(flagName: FeatureFlag, fallback = false): boolean {
  const posthog = usePostHog();
  const [isEnabled, setIsEnabled] = useState(fallback);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!posthog) {
      setIsLoading(false);
      return;
    }

    // Get the feature flag value
    const checkFlag = () => {
      const flagValue = posthog.isFeatureEnabled(flagName);
      setIsEnabled(flagValue ?? fallback);
      setIsLoading(false);
    };

    // Check immediately
    checkFlag();

    // Listen for flag changes
    posthog.onFeatureFlags(() => {
      checkFlag();
    });
  }, [posthog, flagName, fallback]);

  // Return fallback during loading to prevent UI flicker
  return isLoading ? fallback : isEnabled;
}

/**
 * Hook to get all feature flags
 * @returns Record of all feature flags and their values
 */
export function useFeatureFlags(): Record<string, boolean | string> {
  const posthog = usePostHog();
  const [flags, setFlags] = useState<Record<string, boolean | string>>({});

  useEffect(() => {
    if (!posthog) return;

    const updateFlags = () => {
      const allFlags = posthog.getFeatureFlags();
      setFlags(allFlags || {});
    };

    // Get initial flags
    updateFlags();

    // Listen for changes
    posthog.onFeatureFlags(updateFlags);
  }, [posthog]);

  return flags;
}

/**
 * Hook to get feature flag variant for A/B testing
 * @param flagName - The name of the feature flag
 * @returns The variant string or null if not set
 */
export function useFeatureFlagVariant(flagName: FeatureFlag): string | null {
  const posthog = usePostHog();
  const [variant, setVariant] = useState<string | null>(null);

  useEffect(() => {
    if (!posthog) return;

    const checkVariant = () => {
      const flagValue = posthog.getFeatureFlag(flagName);
      setVariant(typeof flagValue === "string" ? flagValue : null);
    };

    // Check immediately
    checkVariant();

    // Listen for changes
    posthog.onFeatureFlags(checkVariant);
  }, [posthog, flagName]);

  return variant;
}