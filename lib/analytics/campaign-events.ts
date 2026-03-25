/**
 * Campaign Analytics Events
 * PostHog tracking for Reddit ad campaign offer variants
 */

import { capturePostHogEvent } from "./posthog";
import { getStoredUTMParams } from "@/lib/hooks/use-utm-tracking";

export type OfferVariant = "trial" | "discount";

function captureCampaignEvent(eventName: string, props: Record<string, unknown>) {
  capturePostHogEvent(eventName, {
    ...props,
    ...getStoredUTMParams(),
  });
}

/** Fires when user lands on /try/job-fit with an offer param */
export function trackCampaignPageViewed(offerVariant: OfferVariant) {
  captureCampaignEvent("campaign_page_viewed", { offer_variant: offerVariant });
}

/** Fires when user submits the job fit form on a campaign page */
export function trackCampaignAnalysisSubmitted(offerVariant: OfferVariant) {
  captureCampaignEvent("campaign_analysis_submitted", { offer_variant: offerVariant });
}

/** Fires when user clicks the offer CTA (trial or discount button) */
export function trackCampaignCtaClicked(offerVariant: OfferVariant, ctaText: string) {
  captureCampaignEvent("campaign_cta_clicked", {
    offer_variant: offerVariant,
    cta_text: ctaText,
  });
}

/** Fires when /signup loads with trial or discount intent from a campaign */
export function trackCampaignSignupIntent(offerVariant: OfferVariant) {
  captureCampaignEvent("campaign_signup_intent", { offer_variant: offerVariant });
}
