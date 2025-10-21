"use client";

import { useFeatureFlagVariant } from "@/lib/hooks/use-feature-flag";
import { FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag";
import { trackConversionEvent } from "@/lib/analytics/conversion-events";
import { useEffect } from "react";

/**
 * Hero copy variants for A/B testing
 */
export const HERO_VARIANTS = {
  control: {
    title: "Land interviews faster with AI-powered career coaching",
    subtitle: "Get expert resume feedback, custom cover letters, and interview prep for $9/month - 99% less than hiring a real career coach.",
    stats: "Track every application • Perfect your resume & cover letters • Land more interviews",
  },
  outcome_focused: {
    title: "Turn applications into interviews with AI coaching",
    subtitle: "Get personalized resume feedback and custom cover letters that help you stand out. Professional career coaching for just $9/month.",
    stats: "Optimize every application • Stand out to recruiters • Interview with confidence",
  },
  price_anchored: {
    title: "Replace your $500/hour career coach with AI for $9",
    subtitle: "Get the same personalized resume reviews, custom cover letters, and interview prep - powered by AI, not expensive consultants.",
    stats: "Save hundreds per month • Get instant feedback • Professional guidance 24/7",
  },
  problem_focused: {
    title: "Stop losing dream jobs to bad resumes",
    subtitle: "Our AI catches every ATS-blocking mistake and writes tailored cover letters in seconds. Land interviews at top companies for just $9/month.",
    stats: "Beat ATS filters • Stand out from other applicants • Get noticed by recruiters",
  },
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;

/**
 * Hook to get the current hero copy variant
 */
export function useHeroCopy() {
  const variant = useFeatureFlagVariant(FEATURE_FLAGS.CONVERSION_HERO_COPY);
  
  // Track which variant was shown
  useEffect(() => {
    if (variant) {
      trackConversionEvent("hero_variant_shown", {
        variant: variant,
        experiment_name: "hero_copy_test",
      });
    }
  }, [variant]);

  // Return the appropriate copy based on variant
  const variantKey = (variant as HeroVariant) || "control";
  return HERO_VARIANTS[variantKey] || HERO_VARIANTS.control;
}

/**
 * Component to render A/B tested hero content
 */
export function HeroContent() {
  const copy = useHeroCopy();

  return (
    <>
      <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
        {copy.title}
      </h1>
      <p className="text-base sm:text-lg lg:text-xl text-foreground">
        {copy.subtitle}
      </p>
      <p className="text-sm font-medium text-primary">
        {copy.stats}
      </p>
    </>
  );
}