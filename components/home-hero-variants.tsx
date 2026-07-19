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
    title: "Build the case for your next raise. Then win it.",
    subtitle: "Log your wins in ten seconds. CareerOtter maps them to your next review, names the gaps while there's still time to close them, and hands you the doc to walk in with.",
    stats: "Free forever • No credit card required",
  },
  outcome_focused: {
    title: "Walk into your review with the receipts",
    subtitle: "Track your wins as they happen and let the AI turn them into a promotion case, review doc, and negotiation plan. Career coaching at a fraction of a coach's cost.",
    stats: "Log wins in seconds • Know your gaps early • Ask with evidence",
  },
  problem_focused: {
    title: "Your best work is invisible by review season",
    subtitle: "Six months of wins, forgotten when it counts. CareerOtter keeps the receipts and builds the case, so you ask for the raise with proof instead of hope.",
    stats: "Keep every win • Close the gaps • Make the ask",
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
      <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground font-display leading-[1.1]">
        {copy.title}
      </h1>
      <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
        {copy.subtitle}
      </p>
      <p className="text-sm font-medium text-muted-foreground">
        {copy.stats}
      </p>
    </>
  );
}