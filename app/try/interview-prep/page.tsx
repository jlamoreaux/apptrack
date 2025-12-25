"use client";

import { useState, useEffect } from "react";
import { InterviewPrepForm, type InterviewPrepFormData } from "@/components/try/interview-prep-form";
import { InterviewPrepResults } from "@/components/try/interview-prep-results";
import { usePreRegistrationRateLimit } from "@/lib/hooks/use-pre-registration-rate-limit";
import { getFingerprint } from "@/lib/utils/fingerprint";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  trackPreviewStarted,
  trackPreviewCompleted,
  trackRateLimitReached,
} from "@/lib/analytics/pre-registration-events";
import { SignupGate } from "@/components/try/signup-gate";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";

export default function TryInterviewPrepPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect logged-in users to dashboard
  const isRedirecting = useAuthRedirect("interview-prep");

  const { canUse, isLoading: checkingLimit, resetAt } = usePreRegistrationRateLimit("interview_prep");

  useEffect(() => {
    if (!checkingLimit && canUse) {
      trackPreviewStarted({
        feature_type: "interview_prep",
        entry_point: document.referrer ? "referral" : "direct",
      });
    }
  }, [checkingLimit, canUse]);

  const handleSubmit = async (formData: InterviewPrepFormData) => {
    setIsLoading(true);
    setError(null);
    const submitStartTime = Date.now();

    try {
      const fingerprint = await getFingerprint();

      const response = await fetch("/api/try/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, fingerprint }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(data.message || "You've already used your free interview prep.");
          trackRateLimitReached({ feature_type: "interview_prep", had_previous_session: true });
        } else {
          setError(data.error || "Failed to generate questions. Please try again.");
        }
        return;
      }

      setResults({ ...data.preview, totalQuestions: data.totalQuestions });
      setSessionId(data.sessionId);

      trackPreviewCompleted({
        feature_type: "interview_prep",
        session_id: data.sessionId,
        generation_time_ms: Date.now() - submitStartTime,
        input_length: formData.jobDescription.length + formData.userBackground.length,
      });
    } catch (err) {
      console.error("Error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking auth or rate limit
  if (isRedirecting || checkingLimit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">You've Used Your Free Interview Prep</h1>
            <p className="text-lg text-muted-foreground">
              Sign up to get 1 more free interview prep + track your applications!
            </p>
          </div>
          {resetAt && (
            <p className="text-sm text-muted-foreground">
              Your free prep resets {new Date(resetAt).toLocaleDateString()} at {new Date(resetAt).toLocaleTimeString()}
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
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Ace Your Next Interview
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          AI generates personalized interview questions in 30 seconds
        </p>
        <p className="text-sm text-muted-foreground">No signup required - Get instant practice questions</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!results ? (
        <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
          <InterviewPrepForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
            <InterviewPrepResults analysis={results} isPreview={true} />
          </div>

          <SignupGate
            featureType="interview_prep"
            sessionId={sessionId}
            title="Your Questions Are Ready!"
            benefits={[
              { text: `All ${results.totalQuestions || results.questions?.length || 0} interview questions` },
              { text: "Suggested approaches for each question" },
              { text: "Practice tips and strategies" },
              { text: "Try all AI features free once" },
            ]}
          />

          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                setResults(null);
                setSessionId(null);
                setError(null);
              }}
            >
              Try Another Job
            </Button>
          </div>
        </div>
      )}

      {!results && (
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-4 text-center">How It Works</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                1
              </div>
              <h4 className="font-medium mb-2">Paste Job Description</h4>
              <p className="text-sm text-muted-foreground">Copy the job posting you're interviewing for</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                2
              </div>
              <h4 className="font-medium mb-2">Share Your Background</h4>
              <p className="text-sm text-muted-foreground">Paste your resume or write a brief summary</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                3
              </div>
              <h4 className="font-medium mb-2">Get Interview Questions</h4>
              <p className="text-sm text-muted-foreground">AI generates tailored questions in 30 seconds</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
