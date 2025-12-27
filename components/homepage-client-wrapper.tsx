"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrafficSourceBanner } from "./traffic-source-banner";
import { parseTrafficSource, getTrafficSourceTrial, storeTrafficSource } from "@/lib/utils/traffic-source";
import type { TrafficSource } from "@/types/promo-codes";
import { clientLogger } from "@/lib/utils/client-logger";
import { LogCategory } from "@/lib/services/logger.types";
import { trackConversionEvent, CONVERSION_EVENTS } from "@/lib/analytics/conversion-events";

export function HomepageClientWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [trafficSource, setTrafficSource] = useState<TrafficSource | null>(null);

  useEffect(() => {
    // Track landing page view
    trackConversionEvent(CONVERSION_EVENTS.LANDING_PAGE_VIEW, {
      page_name: "homepage",
      page_url: window.location.href,
      referrer: document.referrer,
      utm_source: searchParams.get("utm_source") || undefined,
      utm_medium: searchParams.get("utm_medium") || undefined,
      utm_campaign: searchParams.get("utm_campaign") || undefined,
    });

    // Check URL parameters for traffic source
    const utm_source = searchParams.get("utm_source");
    const ref = searchParams.get("ref");
    const source = searchParams.get("source");
    const li_fat_id = searchParams.get("li_fat_id");
    
    // Try to detect source from various parameters
    let sourceToValidate: string | null = null;
    
    if (source) {
      sourceToValidate = source;
    } else if (ref) {
      sourceToValidate = ref;
    } else if (li_fat_id) {
      // LinkedIn Ads specific parameter
      sourceToValidate = "linkedin";
    } else if (utm_source) {
      // Extract source from utm_source (e.g., "reddit_ads" -> "reddit")
      sourceToValidate = utm_source.toLowerCase().split('_')[0];
    }
    
    // Validate and parse the traffic source
    const validatedSource = parseTrafficSource(sourceToValidate);
    
    if (validatedSource) {
      const trial = getTrafficSourceTrial(validatedSource);
      
      // Store validated source and trial info
      storeTrafficSource(validatedSource, trial || undefined);
      setTrafficSource(validatedSource);
      
      clientLogger.info("Traffic source detected and validated", {
        category: LogCategory.BUSINESS,
        action: "traffic_source_detected",
        metadata: {
          source: validatedSource,
          hasTrialOffer: !!trial,
          utm_source,
          ref,
          source_param: source,
          li_fat_id,
          original_value: sourceToValidate,
          url: window.location.href
        }
      });
    }
  }, [searchParams]);

  return (
    <>
      <TrafficSourceBanner source={trafficSource} />
      {children}
    </>
  );
}