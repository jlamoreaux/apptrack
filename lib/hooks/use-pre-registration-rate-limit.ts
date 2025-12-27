"use client";

import { useState, useEffect } from "react";
import { getFingerprint } from "@/lib/utils/fingerprint";

export interface PreRegistrationRateLimitStatus {
  canUse: boolean;
  usedCount: number;
  resetAt: Date | null;
  isLoading: boolean;
}

/**
 * Hook to check if an anonymous user can use a pre-registration AI feature
 * Checks rate limits based on browser fingerprint and IP
 *
 * This is separate from the authenticated user rate limiting system.
 * Use this for /try/* pages where users aren't logged in yet.
 *
 * @param featureType - Type of AI feature (job_fit, cover_letter, etc.)
 * @param enabled - Whether to perform the check (default: true)
 * @returns Pre-registration rate limit status
 */
export function usePreRegistrationRateLimit(
  featureType: string,
  enabled: boolean = true
): PreRegistrationRateLimitStatus {
  const [status, setStatus] = useState<PreRegistrationRateLimitStatus>({
    canUse: true,
    usedCount: 0,
    resetAt: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!enabled) {
      setStatus({
        canUse: true,
        usedCount: 0,
        resetAt: null,
        isLoading: false,
      });
      return;
    }

    async function checkLimit() {
      try {
        // Get browser fingerprint
        const fingerprint = await getFingerprint();

        // Check rate limit via API
        const response = await fetch("/api/try/check-limit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            featureType,
            fingerprint,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to check rate limit");
        }

        const data = await response.json();

        setStatus({
          canUse: data.canUse,
          usedCount: data.usedCount,
          resetAt: data.resetAt ? new Date(data.resetAt) : null,
          isLoading: false,
        });
      } catch (error) {
        console.error("Rate limit check error:", error);

        // On error, allow usage but log the issue
        setStatus({
          canUse: true,
          usedCount: 0,
          resetAt: null,
          isLoading: false,
        });
      }
    }

    checkLimit();
  }, [featureType, enabled]);

  return status;
}

/**
 * Track that a pre-registration feature was used
 * Call this after successfully generating AI content
 *
 * @param featureType - Type of AI feature used
 * @param fingerprint - Browser fingerprint (optional, will be generated if not provided)
 */
export async function trackPreRegistrationUsage(
  featureType: string,
  fingerprint?: string
): Promise<void> {
  try {
    const fp = fingerprint || (await getFingerprint());

    await fetch("/api/try/track-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        featureType,
        fingerprint: fp,
      }),
    });
  } catch (error) {
    console.error("Failed to track usage:", error);
    // Don't throw - this is a non-critical operation
  }
}
