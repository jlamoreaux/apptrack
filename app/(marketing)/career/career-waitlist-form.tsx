"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REVIEW_TIMING_OPTIONS,
  CAREER_CAMPAIGN,
  type CareerWaitlistSource,
} from "@/lib/constants/career";
import {
  trackCareerWaitlistViewed,
  trackCareerEmailClicked,
} from "@/lib/analytics/career-events";
import {
  useUTMTracking,
  getStoredUTMParams,
} from "@/lib/hooks/use-utm-tracking";
// Share the format check with the server (lib/email/validate is pure/client-safe)
// so the client pre-check and the API's validateEmail can't disagree.
import { isValidEmailFormat } from "@/lib/email/validate";

interface CareerWaitlistFormProps {
  /** Pre-fills the email input when the visitor is logged in; null otherwise. */
  userEmail: string | null;
}

/**
 * Best-effort PostHog distinct id so the server-side career_waitlist_joined
 * event stitches to the same browser session as career_waitlist_viewed.
 * Any failure (posthog not loaded, blocked, no id) resolves to undefined.
 */
async function getPhDistinctId(): Promise<string | undefined> {
  try {
    const { default: posthog } = await import("posthog-js");
    const id = posthog.get_distinct_id?.();
    return typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

export function CareerWaitlistForm({ userEmail }: CareerWaitlistFormProps) {
  const searchParams = useSearchParams();
  // Persist UTMs from the email/banner link into sessionStorage for this session.
  useUTMTracking();

  const source: CareerWaitlistSource = useMemo(() => {
    const medium = searchParams.get("utm_medium");
    const utmSource = searchParams.get("utm_source");
    if (medium === "banner") return "banner";
    if (medium === "email" || utmSource === "email") return "email";
    return "direct";
  }, [searchParams]);

  const [email, setEmail] = useState(userEmail ?? "");
  const [reviewTiming, setReviewTiming] = useState("");
  const [emailError, setEmailError] = useState("");
  const [timingError, setTimingError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  // Fire viewed once on mount; email_clicked only when arriving from the
  // validation email (utm_campaign match). Both are de-duped downstream.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackCareerWaitlistViewed({ source });
    if (searchParams.get("utm_campaign") === CAREER_CAMPAIGN) {
      trackCareerEmailClicked();
    }
  }, [source, searchParams]);

  // Success state replaces the form entirely — no silent failures, no lingering form.
  if (joined) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-secondary" />
          <h2 className="text-lg font-semibold text-foreground">
            You&apos;re on the list.
          </h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you as soon as the career companion is ready to try.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setEmailError("");
    setTimingError("");

    // Client-side quick checks before hitting the network.
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!isValidEmailFormat(email.trim())) {
      setEmailError("Please enter a valid email address");
      return;
    }
    if (!reviewTiming) {
      setTimingError("Please select when your next review is");
      return;
    }

    setIsSubmitting(true);
    try {
      const phDistinctId = await getPhDistinctId();
      const response = await fetch("/api/career-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          review_timing: reviewTiming,
          source,
          utm: getStoredUTMParams(),
          ph_distinct_id: phDistinctId,
        }),
      });

      if (response.ok) {
        setJoined(true);
        return;
      }

      const data = await response.json().catch(() => null);
      if (response.status === 429) {
        setSubmitError(
          data?.error || "Too many attempts. Please try again in an hour."
        );
      } else if (response.status === 400) {
        // Surface the server's specific validation message inline.
        setSubmitError(data?.error || "Please check your details and try again.");
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    } catch {
      // Network / unknown failure — retryable, never silent.
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="career-email">Email</Label>
        <Input
          id="career-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          disabled={isSubmitting}
          className={`min-h-[44px] ${
            emailError ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "career-email-error" : undefined}
        />
        {emailError && (
          <p id="career-email-error" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-timing">
          When is your next performance review?
        </Label>
        <Select
          value={reviewTiming}
          onValueChange={(value) => {
            setReviewTiming(value);
            if (timingError) setTimingError("");
          }}
          disabled={isSubmitting}
        >
          <SelectTrigger
            id="review-timing"
            className="min-h-[44px]"
            aria-invalid={timingError ? true : undefined}
            aria-describedby={timingError ? "review-timing-error" : undefined}
          >
            <SelectValue placeholder="Select timing" />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_TIMING_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {timingError && (
          <p id="review-timing-error" className="text-sm text-destructive">
            {timingError}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full min-h-[44px] bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Joining...
          </>
        ) : (
          "Join the waitlist"
        )}
      </Button>
    </form>
  );
}
