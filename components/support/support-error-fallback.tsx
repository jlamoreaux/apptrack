"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

// Cap the error message we forward to the support page so the URL stays sane.
const MAX_ERROR_MESSAGE_LENGTH = 300;

const SUPPORT_PATH = "/dashboard/support";

interface SupportErrorFallbackProps {
  /** Human-readable name of the boundary, used for messaging and analytics. */
  name?: string;
  /** The error that triggered the boundary, if available. */
  error?: Error;
  /**
   * Recovery callback (e.g. Next.js `reset`). When absent the fallback performs
   * a full page reload. It must never silently re-render the same subtree, which
   * would infinite-loop on deterministic errors.
   */
  reset?: () => void;
}

function buildSupportHref(error?: Error): string {
  const message = error?.message;
  if (!message) return SUPPORT_PATH;

  const truncated = message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  return `${SUPPORT_PATH}?errorMessage=${encodeURIComponent(truncated)}`;
}

/**
 * Accessible fallback UI for error boundaries.
 *
 * When a custom `fallback` is passed to `AccessibleErrorBoundary`, it is
 * rendered directly and the boundary's built-in role/aria/focus handling is
 * bypassed. This component therefore re-implements those a11y traits itself.
 */
export function SupportErrorFallback({
  name,
  error,
  reset,
}: SupportErrorFallbackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTrackedRef = useRef(false);

  // Move focus to the alert so screen readers announce it immediately.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Fire the analytics event exactly once per mount. Wrap in try/catch so a
  // throwing analytics call can never defeat the boundary it lives inside.
  useEffect(() => {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;
    try {
      capturePostHogEvent("error_boundary_triggered", {
        boundary: name,
        message: error?.message,
      });
    } catch {
      // Intentionally swallowed: a fallback must not throw.
    }
  }, [name, error]);

  const handleRecover = () => {
    if (reset) {
      reset();
      return;
    }
    window.location.reload();
  };

  return (
    <div
      ref={containerRef}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className="rounded-lg border border-border bg-muted/40 p-6 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground">
          {name
            ? `We hit an unexpected problem in ${name}. The rest of the app should still work.`
            : "We hit an unexpected problem. The rest of the app should still work."}
          {" "}
          You can try again, or contact support if it keeps happening.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleRecover}
            className="min-h-11"
          >
            Try again
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <a href={buildSupportHref(error)}>Contact support</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SupportErrorFallback;
