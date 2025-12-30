"use client";

import { useFeatureFlagVariant } from "@/lib/hooks/use-feature-flag";
import { FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag";
import { trackConversionEvent } from "@/lib/analytics/conversion-events";
import { useEffect } from "react";
import copyData from "@/content/copy.json";

const AI_COACH_PRICE = copyData.pricing.plans.ai_coach.price;

/**
 * Hero copy variants for A/B testing
 */
export const HERO_VARIANTS = {
  control: {
    title: "Never lose track of your dream job again",
    subtitle: "The smart job application tracker with AI-powered career coaching. Organize applications, visualize your pipeline, and get expert help with resumes, cover letters, and interview prep.",
    stats: "Start organizing your job search today",
  },
  outcome_focused: {
    title: "Turn applications into interviews with AI coaching",
    subtitle: "Get personalized resume feedback and custom cover letters that help you stand out. Professional career coaching at a fraction of the cost.",
    stats: "Optimize every application • Stand out to recruiters • Interview with confidence",
  },
  problem_focused: {
    title: "Stop losing dream jobs to bad resumes",
    subtitle: "Our AI catches every ATS-blocking mistake and writes tailored cover letters in seconds. Land interviews at top companies.",
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