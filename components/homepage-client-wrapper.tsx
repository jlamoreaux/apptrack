"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrafficSourceBanner } from "./traffic-source-banner";
import { clientLogger } from "@/lib/utils/client-logger";
import { LogCategory } from "@/lib/services/logger.types";

export function HomepageClientWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [trafficSource, setTrafficSource] = useState<"reddit" | "linkedin" | null>(null);

  useEffect(() => {
    // Check URL parameters for traffic source
    const utm_source = searchParams.get("utm_source");
    const ref = searchParams.get("ref");
    const source = searchParams.get("source");
    
    let detectedSource: "reddit" | "linkedin" | null = null;
    
    // Check various parameter combinations
    if (
      utm_source === "reddit" || 
      ref === "reddit" || 
      source === "reddit" ||
      utm_source?.toLowerCase().includes("reddit")
    ) {
      detectedSource = "reddit";
    } else if (
      utm_source === "linkedin" || 
      ref === "linkedin" || 
      source === "linkedin" ||
      utm_source?.toLowerCase().includes("linkedin")
    ) {
      detectedSource = "linkedin";
    }
    
    if (detectedSource) {
      setTrafficSource(detectedSource);
      
      // Store in session for later use
      sessionStorage.setItem("initial_traffic_source", detectedSource);
      
      clientLogger.info("Traffic source detected", {
        category: LogCategory.BUSINESS,
        action: "traffic_source_detected",
        metadata: {
          source: detectedSource,
          utm_source,
          ref,
          source_param: source,
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