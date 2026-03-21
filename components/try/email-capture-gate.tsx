"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface EmailCaptureGateProps {
  source: string;
  sessionId: string | null;
  isProcessing: boolean;
  onEmailCaptured: (fullResults?: any) => void;
  onSkip: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailCaptureGate({
  source,
  sessionId,
  isProcessing,
  onEmailCaptured,
  onSkip,
}: EmailCaptureGateProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [captured, setCaptured] = useState(false);

  // Success state
  if (captured) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-secondary" />
          <p className="text-sm font-medium text-foreground">
            Email saved! Loading your full results...
          </p>
          <Spinner size="md" className="text-primary mt-2" />
        </div>
      </div>
    );
  }

  function validateEmail(value: string): boolean {
    if (!value.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!validateEmail(email)) return;

    setIsSubmitting(true);
    try {
      // Step 1: Capture email (add to audience + schedule drips)
      const captureRes = await fetch("/api/try/capture-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      if (!captureRes.ok) {
        const data = await captureRes.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }

      setCaptured(true);

      // Step 2: Unlock full results if we have a sessionId
      let fullResults = undefined;
      if (sessionId) {
        try {
          const unlockRes = await fetch("/api/try/unlock-with-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, email }),
          });

          if (unlockRes.ok) {
            const unlockData = await unlockRes.json();
            fullResults = unlockData.analysis;
          }
        } catch {
          // Unlock failed — still captured email, parent will show preview
        }
      }

      onEmailCaptured(fullResults);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 sm:p-8 text-center">
      {/* Processing indicator */}
      <div className="flex flex-col items-center gap-3 mb-6">
        {isProcessing ? (
          <>
            <Spinner size="lg" className="text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Generating your results...
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-foreground">
            Your results are ready — enter your email to view them
          </p>
        )}
      </div>

      {/* Email capture form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">
            Unlock your full results
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a copy too
          </p>
        </div>

        <div className="max-w-sm mx-auto space-y-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            onBlur={() => {
              if (email) validateEmail(email);
            }}
            disabled={isSubmitting}
            className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {emailError && (
            <p className="text-sm text-destructive">{emailError}</p>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Unlocking...
            </>
          ) : (
            "Unlock Full Results"
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          No spam. Unsubscribe anytime.
        </p>

        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </form>
    </div>
  );
}
