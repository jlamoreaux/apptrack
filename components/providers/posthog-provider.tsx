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

  return <></>;
}
