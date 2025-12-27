/**
 * LinkedIn Conversion Tracking
 *
 * Fires LinkedIn conversion events via the Insight Tag.
 * Conversion IDs are configured in LinkedIn Campaign Manager.
 */

// LinkedIn conversion IDs from Campaign Manager
// Set these in your environment variables
export const LINKEDIN_CONVERSIONS = {
  SIGNUP: process.env.NEXT_PUBLIC_LINKEDIN_SIGNUP_CONVERSION_ID || "",
  PURCHASE: process.env.NEXT_PUBLIC_LINKEDIN_PURCHASE_CONVERSION_ID || "",
} as const;

// Type for the lintrk function
declare global {
  interface Window {
    lintrk?: (action: string, data: { conversion_id: string | number }) => void;
  }
}

/**
 * Track a LinkedIn conversion event
 * @param conversionId - The conversion ID from LinkedIn Campaign Manager
 */
export function trackLinkedInConversion(conversionId: string | number): void {
  if (typeof window === "undefined") return;

  // Ensure conversion ID is valid
  if (!conversionId) {
    console.warn("[LinkedIn] No conversion ID provided");
    return;
  }

  // Check if lintrk is available
  if (typeof window.lintrk === "function") {
    window.lintrk("track", { conversion_id: conversionId });
    console.log(`[LinkedIn] Conversion tracked: ${conversionId}`);
  } else {
    console.warn("[LinkedIn] lintrk not available - Insight Tag may not be loaded");
  }
}

/**
 * Track signup conversion
 */
export function trackLinkedInSignup(): void {
  if (LINKEDIN_CONVERSIONS.SIGNUP) {
    trackLinkedInConversion(LINKEDIN_CONVERSIONS.SIGNUP);
  }
}

/**
 * Track purchase/upgrade conversion
 * @param value - Optional purchase value in dollars
 */
export function trackLinkedInPurchase(value?: number): void {
  if (LINKEDIN_CONVERSIONS.PURCHASE) {
    trackLinkedInConversion(LINKEDIN_CONVERSIONS.PURCHASE);
    // Note: LinkedIn doesn't support passing value via lintrk() -
    // value must be configured in Campaign Manager or via CAPI
  }
}
