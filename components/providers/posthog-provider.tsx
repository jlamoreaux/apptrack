"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

if (typeof window !== "undefined") {
  // Never initialize PostHog on localhost — keeps dev events out of production data
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168.");

  if (!isLocalhost) {
    // Use development key if available and in development mode
    const isDevelopment = process.env.NODE_ENV === "development";
    const posthogKey =
      isDevelopment && process.env.NEXT_PUBLIC_POSTHOG_DEV_KEY
        ? process.env.NEXT_PUBLIC_POSTHOG_DEV_KEY
        : process.env.NEXT_PUBLIC_POSTHOG_KEY;

    // Only initialize PostHog if we have a valid key
    if (posthogKey && process.env.NEXT_PUBLIC_POSTHOG_DISABLED !== "true") {
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // Disable automatic pageview capture, as we capture manually
        capture_exceptions: true, // Capture JS exceptions with full stack traces
        debug: isDevelopment,
        loaded: () => {
          if (process.env.NEXT_PUBLIC_POSTHOG_DISABLED === "true") {
            return;
          }
          posthog.setPersonProperties({
            environment: "production",
            hostname: window.location.hostname,
          });
        },
      });
    }
  }
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

export function PostHogPageView(): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  // Capture UTM attribution on landing. PostHog records UTM params in pageview
  // events automatically, but this also sets person-level properties so we can
  // segment users by acquisition source (e.g. "came from chatgpt.com") and
  // track whether they converted.
  useEffect(() => {
    const utmSource = searchParams.get("utm_source");
    if (!utmSource) return;

    const utmMedium = searchParams.get("utm_medium") ?? undefined;
    const utmCampaign = searchParams.get("utm_campaign") ?? undefined;
    const utmContent = searchParams.get("utm_content") ?? undefined;
    const utmTerm = searchParams.get("utm_term") ?? undefined;

    // Always update "last touch" person properties
    posthog.setPersonProperties({
      last_utm_source: utmSource,
      ...(utmMedium && { last_utm_medium: utmMedium }),
      ...(utmCampaign && { last_utm_campaign: utmCampaign }),
    });

    // Set "first touch" properties only once per browser — survives across sessions
    const firstTouchKey = "apptrack_first_utm_set";
    if (!localStorage.getItem(firstTouchKey)) {
      posthog.setPersonProperties({
        first_utm_source: utmSource,
        ...(utmMedium && { first_utm_medium: utmMedium }),
        ...(utmCampaign && { first_utm_campaign: utmCampaign }),
      });
      localStorage.setItem(firstTouchKey, "1");
    }

    // Fire a discrete event so we can build funnels: utm_visit → signed_up → upgraded
    posthog.capture("utm_visit", {
      utm_source: utmSource,
      ...(utmMedium && { utm_medium: utmMedium }),
      ...(utmCampaign && { utm_campaign: utmCampaign }),
      ...(utmContent && { utm_content: utmContent }),
      ...(utmTerm && { utm_term: utmTerm }),
    });
  // Only run on initial mount — UTM params don't change mid-session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <></>;
}
