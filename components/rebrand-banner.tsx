"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { REBRAND_COPY } from "@/lib/constants/rebrand";

const DISMISS_KEY = "ff:rebrand-banner-dismissed";

// NEXT_PUBLIC_* env vars must be referenced as static literals for Next to
// inline them into the client bundle — a dynamic process.env[key] lookup is
// not replaced at build time and reads undefined in the browser.
function bannerWindowOpen(): boolean {
  return process.env.NEXT_PUBLIC_REBRAND_BANNER === "on";
}

/**
 * Existing users (created before the rename cutover) see the banner; accounts
 * created at/after the cutover are new and never do. Fail closed: if either the
 * account timestamp or the cutover instant is missing/unparseable, treat the
 * user as ineligible so the banner never shows to the wrong audience.
 */
function createdBeforeCutover(createdAt: string | undefined): boolean {
  const cutoverRaw = process.env.NEXT_PUBLIC_REBRAND_CUTOVER_AT;
  if (!createdAt || !cutoverRaw) return false;
  const created = Date.parse(createdAt);
  const cutover = Date.parse(cutoverRaw);
  if (Number.isNaN(created) || Number.isNaN(cutover)) return false;
  return created < cutover;
}

export function RebrandBanner() {
  const { user, loading } = useSupabaseAuth();
  // Assume dismissed until localStorage is read, so an already-dismissed banner
  // never flashes on load.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  const visible =
    !loading &&
    !!user &&
    bannerWindowOpen() &&
    createdBeforeCutover(user.created_at) &&
    !dismissed;

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Per-device dismissal is best-effort; a storage failure just means the
      // banner may reappear next load — never a crash or a blocked render.
    }
    capturePostHogEvent("rebrand_banner_dismissed");
  }, []);

  // Fire the impression at most once per mount, so a brief auth flicker can't
  // inflate the shown count with duplicate events.
  const shownFired = useRef(false);
  useEffect(() => {
    if (visible && !shownFired.current) {
      shownFired.current = true;
      capturePostHogEvent("rebrand_banner_shown");
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleDismiss]);

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="bg-primary text-primary-foreground">
      <div className="container mx-auto flex items-center gap-4 px-4 py-3">
        <p className="flex-1 text-sm sm:text-base">
          <span className="font-semibold">{REBRAND_COPY.headline}</span>{" "}
          <span className="opacity-90">{REBRAND_COPY.subhead}</span>{" "}
          <Link href={REBRAND_COPY.whyHref} className="underline underline-offset-2">
            {REBRAND_COPY.whyLabel}
          </Link>
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-primary-foreground/10"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
