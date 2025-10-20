# PostHog A/B Testing Setup Guide

## Overview
This guide explains how to set up and use A/B tests in AppTrack using PostHog feature flags.

## Available Feature Flags

### Conversion Optimization Flags
- `conversion-hero-copy` - Hero section copy variants
- `pricing-structure-v2` - New pricing page layout
- `ai-teaser-design` - AI feature teaser designs
- `referral-program-beta` - Referral program rollout

## Setting Up Feature Flags in PostHog

1. **Log into PostHog Dashboard**
   - Go to your PostHog project
   - Navigate to "Feature Flags" section

2. **Create a New Feature Flag**
   ```
   Name: conversion-hero-copy
   Key: conversion-hero-copy
   Type: Multiple variants (for A/B test) or Boolean (for simple on/off)
   ```

3. **Configure Variants** (for A/B tests)
   ```
   Variants:
   - control (25%)
   - outcome_focused (25%)
   - price_anchored (25%)
   - problem_focused (25%)
   ```

4. **Set Rollout Percentage**
   - Start with 10% for initial testing
   - Gradually increase as you gain confidence

5. **Target Specific Users** (optional)
   - New users only
   - By geographic location
   - By signup date

## Using Feature Flags in Code

### Simple Boolean Flag
```tsx
import { useFeatureFlag, FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag";

function MyComponent() {
  const isReferralEnabled = useFeatureFlag(FEATURE_FLAGS.REFERRAL_PROGRAM_BETA);
  
  if (isReferralEnabled) {
    return <ReferralProgram />;
  }
  
  return null;
}
```

### A/B Test with Variants
```tsx
import { useFeatureFlagVariant, FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag";

function HeroSection() {
  const variant = useFeatureFlagVariant(FEATURE_FLAGS.CONVERSION_HERO_COPY);
  
  switch (variant) {
    case "outcome_focused":
      return <OutcomeFocusedHero />;
    case "price_anchored":
      return <PriceAnchoredHero />;
    default:
      return <DefaultHero />;
  }
}
```

## Tracking A/B Test Results

### Automatic Tracking
The feature flag hooks automatically track when variants are shown.

### Custom Event Tracking
```tsx
import { trackConversionEvent } from "@/lib/analytics/conversion-events";

// Track when a user interacts with the tested element
trackConversionEvent("hero_cta_clicked", {
  variant: variant,
  experiment_name: "hero_copy_test",
});
```

## Analyzing Results in PostHog

1. **Create a Funnel**
   - Start: `hero_variant_shown`
   - End: `upgrade_completed`
   - Group by: `variant`

2. **Monitor Key Metrics**
   - Conversion rate by variant
   - Statistical significance
   - Sample size per variant

3. **Make Decisions**
   - Wait for statistical significance (usually 95%+)
   - Consider both conversion rate and revenue impact
   - Document learnings for future tests

## Best Practices

1. **Test One Thing at a Time**
   - Don't change multiple elements simultaneously
   - Makes it clear what drove the results

2. **Run Tests Long Enough**
   - Account for weekly patterns
   - Minimum 1-2 weeks for most tests
   - Need ~1000 users per variant for significance

3. **Start Small**
   - Begin with 10% rollout
   - Monitor for bugs or issues
   - Scale up gradually

4. **Document Everything**
   - What you're testing and why
   - Hypothesis and success criteria
   - Results and learnings

## Example Test Plan

### Hero Copy A/B Test
**Hypothesis**: Outcome-focused copy will increase signups by 20%

**Variants**:
- Control: Current copy
- Test A: Outcome-focused (3x faster hiring)
- Test B: Price-anchored ($500 vs $9)
- Test C: Problem-focused (bad resumes)

**Success Metrics**:
- Primary: Signup conversion rate
- Secondary: Upgrade conversion rate

**Duration**: 2 weeks minimum

**Sample Size**: 250 users per variant minimum