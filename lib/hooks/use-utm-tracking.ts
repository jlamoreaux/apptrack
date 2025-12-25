"use client";

import { useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

type UTMParams = {
  [key in (typeof UTM_PARAMS)[number]]?: string;
};

const UTM_STORAGE_KEY = "apptrack_utm_params";

/**
 * Track storage errors to PostHog for debugging
 */
function trackStorageError(operation: "read" | "write", error: unknown) {
  capturePostHogEvent("utm_storage_error", {
    operation,
    error_message: error instanceof Error ? error.message : String(error),
    error_name: error instanceof Error ? error.name : "Unknown",
    storage_available: typeof sessionStorage !== "undefined",
  });
}

/**
 * Hook to capture and persist UTM parameters
 * Stores UTM params in sessionStorage for use throughout the session
 */
export function useUTMTracking() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmParams: UTMParams = {};
    let hasUTM = false;

    UTM_PARAMS.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        utmParams[param] = value;
        hasUTM = true;
      }
    });

    if (hasUTM) {
      try {
        sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams));
      } catch (e) {
        trackStorageError("write", e);
      }
    }
  }, [searchParams]);

  const getUTMParams = useCallback((): UTMParams => {
    try {
      const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      trackStorageError("read", e);
    }
    return {};
  }, []);

  const buildURLWithUTM = useCallback(
    (baseUrl: string): string => {
      const utmParams = getUTMParams();
      const url = new URL(baseUrl, window.location.origin);

      Object.entries(utmParams).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });

      return url.toString();
    },
    [getUTMParams]
  );

  return { getUTMParams, buildURLWithUTM };
}

/**
 * Get UTM params for analytics events
 * Can be used outside of React components
 */
export function getStoredUTMParams(): UTMParams {
  if (typeof window === "undefined") return {};

  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    trackStorageError("read", e);
  }
  return {};
}
