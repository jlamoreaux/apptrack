"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trackConversionEvent, CONVERSION_EVENTS } from "@/lib/analytics/conversion-events";

export function HomepageClientWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

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
  }, [searchParams]);

  return <>{children}</>;
}