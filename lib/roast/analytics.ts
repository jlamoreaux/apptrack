// Analytics tracking for roast usage using PostHog (primary) and Vercel Analytics
import { usePostHog } from "posthog-js/react";

// For use in React components (hooks)
export function useRoastAnalytics() {
  const posthog = usePostHog();
  
  const trackEvent = (event: string, properties?: Record<string, any>) => {
    // Only log if debug flag is set
    // Enable with: localStorage.setItem('debug_analytics', 'true')
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && window.localStorage?.getItem("debug_analytics")) {
      console.log(`[Analytics] ${event}`, properties);
    }
    
    // Send to PostHog using the hook
    posthog?.capture(event, properties);
    
    // Send to Vercel Analytics
    if (typeof window !== "undefined" && (window as any).va) {
      (window as any).va("track", event, properties);
    }
  };
  
  return { trackEvent };
}

// For use outside React components (direct import)
export function trackRoastEvent(event: string, properties?: Record<string, any>) {
  // Only log if debug flag is set
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && window.localStorage?.getItem("debug_analytics")) {
    console.log(`[Analytics] ${event}`, properties);
  }
  
  // Import PostHog directly for non-component usage
  if (typeof window !== "undefined") {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.capture(event, properties);
    });
    
    // Send to Vercel Analytics
    if ((window as any).va) {
      (window as any).va("track", event, properties);
    }
  }
}

export const ROAST_EVENTS = {
  UPLOAD_STARTED: "roast_upload_started",
  UPLOAD_COMPLETED: "roast_upload_completed",
  UPLOAD_FAILED: "roast_upload_failed",
  ROAST_VIEWED: "roast_viewed",
  ROAST_SHARED: "roast_shared",
  SIGNUP_CLICKED: "roast_signup_clicked",
  LIMIT_REACHED: "roast_limit_reached",
} as const;