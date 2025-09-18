"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

if (typeof window !== "undefined") {
  // Use development key if available and in development mode
  const isDevelopment = process.env.NODE_ENV === "development";
  const posthogKey =
    isDevelopment && process.env.NEXT_PUBLIC_POSTHOG_DEV_KEY
      ? process.env.NEXT_PUBLIC_POSTHOG_DEV_KEY
      : process.env.NEXT_PUBLIC_POSTHOG_KEY;

  // Only initialize PostHog if we have a valid key
  if (posthogKey) {
    posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // Disable automatic pageview capture, as we capture manually
    // Development settings
    debug: isDevelopment,
    // Use separate project/environment for development if available
    loaded: () => {
      if (process.env.NEXT_PUBLIC_POSTHOG_DISABLED === "true") {
        return;
      }
      if (isDevelopment) {
        // Tag development events
        posthog.setPersonProperties({
          environment: "development",
          localhost: true,
          hostname: window.location.hostname,
        });
      } else {
        posthog.setPersonProperties({
          environment: "production",
        });
      }
    },
    });
  }
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

export function PostHogPageView(): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog.__loaded) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return <></>;
}
