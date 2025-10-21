"use client";

import { useState } from "react";
import { JobFitForm, type JobFitFormData } from "@/components/try/job-fit-form";
import { JobFitResults } from "@/components/try/job-fit-results";
import { usePreRegistrationRateLimit } from "@/lib/hooks/use-pre-registration-rate-limit";
import { getFingerprint } from "@/lib/utils/fingerprint";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TryJobFitPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check rate limit
  const { canUse, isLoading: checkingLimit, resetAt } =
    usePreRegistrationRateLimit("job_fit");

  const handleSubmit = async (formData: JobFitFormData) => {
    setIsLoading(true);
    setError(null);

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
        } else {
          setError(data.error || "Failed to generate analysis. Please try again.");
        }
        return;
      }

      // Set results and session ID
      setResults(data.preview);
      setSessionId(data.sessionId);

      // Track event in PostHog
      if (window.posthog) {
        window.posthog.capture("try_job_fit_completed", {
          fit_score: data.preview.fitScore,
        });
      }
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600" />
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
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
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
        <div className="bg-white rounded-lg border p-6 sm:p-8 shadow-sm">
          <JobFitForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Results */}
          <div className="bg-white rounded-lg border p-6 sm:p-8 shadow-sm">
            <JobFitResults analysis={results} isPreview={true} />
          </div>

          {/* Signup Gate Placeholder */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200 p-8 text-center">
            <h3 className="text-2xl font-semibold mb-4">
              🎉 Your Analysis is Ready!
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sign up free to unlock:
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2 mb-8">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Full analysis with detailed breakdown</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Specific gaps and how to address them</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Actionable next steps</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Save and track this application</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Try all AI features free once</span>
              </li>
            </ul>

            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <Button size="lg" className="w-full" asChild>
                <Link href={`/signup?session=${sessionId}`}>
                  Sign Up Free to Unlock
                </Link>
              </Button>

              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/signin" className="underline hover:text-primary">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

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
        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-4 text-center">How It Works</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                1
              </div>
              <h4 className="font-medium mb-2">Paste Job Description</h4>
              <p className="text-sm text-muted-foreground">
                Copy the job posting you're interested in
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                2
              </div>
              <h4 className="font-medium mb-2">Share Your Background</h4>
              <p className="text-sm text-muted-foreground">
                Paste your resume or write a brief summary
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
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
