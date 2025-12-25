"use client";

import { useState, useEffect } from "react";
import { JobFitForm, type JobFitFormData } from "@/components/try/job-fit-form";
import { JobFitResults } from "@/components/try/job-fit-results";
import { usePreRegistrationRateLimit } from "@/lib/hooks/use-pre-registration-rate-limit";
import { getFingerprint } from "@/lib/utils/fingerprint";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { trackPreviewStarted, trackPreviewCompleted, trackRateLimitReached } from "@/lib/analytics/pre-registration-events";
import { SignupGate } from "@/components/try/signup-gate";

export default function TryJobFitPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Check rate limit
  const { canUse, isLoading: checkingLimit, resetAt } =
    usePreRegistrationRateLimit("job_fit");

  // Track page view / preview started
  useEffect(() => {
    if (!checkingLimit && canUse) {
      trackPreviewStarted({
        feature_type: "job_fit",
        entry_point: document.referrer ? "referral" : "direct",
      });
    }
  }, [checkingLimit, canUse]);

  const handleSubmit = async (formData: JobFitFormData) => {
    setIsLoading(true);
    setError(null);
    const submitStartTime = Date.now();
    setStartTime(submitStartTime);

    try {
      // Get browser fingerprint
      const fingerprint = await getFingerprint();

      // Call API
      const response = await fetch("/api/try/job-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          fingerprint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(data.message || "You've already used your free analysis.");
          trackRateLimitReached({
            feature_type: "job_fit",
            had_previous_session: true,
          });
        } else {
          setError(data.error || "Failed to generate analysis. Please try again.");
        }
        return;
      }

      // Set results and session ID
      setResults(data.preview);
      setSessionId(data.sessionId);

      // Track completion with detailed metrics
      const generationTime = Date.now() - submitStartTime;
      trackPreviewCompleted({
        feature_type: "job_fit",
        session_id: data.sessionId,
        generation_time_ms: generationTime,
        input_length: formData.jobDescription.length + formData.userBackground.length,
      });
    } catch (err) {
      console.error("Error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking rate limit
  if (checkingLimit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking availability...</p>
        </div>
      </div>
    );
  }

  // Rate limit reached
  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-2">
              You've Used Your Free Analysis
            </h1>
            <p className="text-lg text-muted-foreground">
              Sign up to get 1 more free job fit analysis + track your applications!
            </p>
          </div>

          {resetAt && (
            <p className="text-sm text-muted-foreground">
              Your free analysis resets{" "}
              {new Date(resetAt).toLocaleDateString()} at{" "}
              {new Date(resetAt).toLocaleTimeString()}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button size="lg" asChild>
              <Link href="/signup">Sign Up Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Find Out If You're a Good Fit
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          AI analyzes the job description against your background in 30 seconds
        </p>
        <p className="text-sm text-muted-foreground">
          No signup required • Get instant insights
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form or Results */}
      {!results ? (
        <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
          <JobFitForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Results */}
          <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
            <JobFitResults analysis={results} isPreview={true} />
          </div>

          {/* Signup Gate */}
          <SignupGate
            featureType="job_fit"
            sessionId={sessionId}
            title="Your Analysis is Ready!"
            benefits={[
              { text: "Full analysis with detailed breakdown" },
              { text: "Specific gaps and how to address them" },
              { text: "Actionable next steps" },
              { text: "Save and track this application" },
              { text: "Try all AI features free once" },
            ]}
          />

          {/* Try Another Application */}
          <div className="text-center">
            <Button variant="outline" onClick={() => {
              setResults(null);
              setSessionId(null);
              setError(null);
            }}>
              Analyze Another Job
            </Button>
          </div>
        </div>
      )}

      {/* How It Works */}
      {!results && (
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-4 text-center">How It Works</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                1
              </div>
              <h4 className="font-medium mb-2">Paste Job Description</h4>
              <p className="text-sm text-muted-foreground">
                Copy the job posting you're interested in
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                2
              </div>
              <h4 className="font-medium mb-2">Share Your Background</h4>
              <p className="text-sm text-muted-foreground">
                Paste your resume or write a brief summary
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                3
              </div>
              <h4 className="font-medium mb-2">Get Instant Analysis</h4>
              <p className="text-sm text-muted-foreground">
                AI analyzes your fit in 30 seconds
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
