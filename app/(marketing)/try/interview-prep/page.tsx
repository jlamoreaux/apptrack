"use client";

import { useState, useEffect } from "react";
import { InterviewPrepForm, type InterviewPrepFormData } from "@/components/try/interview-prep-form";
import { InterviewPrepResults } from "@/components/try/interview-prep-results";
import { QuickTips } from "@/components/try/quick-tips";
import { usePreRegistrationRateLimit } from "@/lib/hooks/use-pre-registration-rate-limit";
import { getFingerprint } from "@/lib/utils/fingerprint";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SampleResultPreview } from "@/components/try/sample-result-preview";
import { EmailCaptureGate } from "@/components/try/email-capture-gate";
import Link from "next/link";
import {
  trackPreviewStarted,
  trackPreviewCompleted,
  trackRateLimitReached,
} from "@/lib/analytics/pre-registration-events";
import { SignupGate } from "@/components/try/signup-gate";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { formatLocalDate, formatLocalTime } from "@/lib/utils/date";
import posthog from "posthog-js";

export default function TryInterviewPrepPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [emailSkipped, setEmailSkipped] = useState(false);
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
    setShowEmailGate(true);
    setError(null);
    const submitStartTime = Date.now();

    try {
      const fingerprint = await getFingerprint();

      const response = await fetch("/api/try/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, fingerprint, phDistinctId: posthog.get_distinct_id() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(data.message || "You've already used your free interview prep.");
          setShowEmailGate(false);
          trackRateLimitReached({ feature_type: "interview_prep", had_previous_session: true });
        } else {
          setError(data.error || "Failed to generate questions. Please try again.");
          setShowEmailGate(false);
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
      setShowEmailGate(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Rate limit reached — separate full-page state
  if (!checkingLimit && !canUse) {
    return (
      <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">You&apos;ve Used Your Free Interview Prep</h1>
            <p className="text-lg text-muted-foreground">
              Sign up free to access all AI tools and track your job search!
            </p>
          </div>
          {resetAt && (
            <p className="text-sm text-muted-foreground">
              Your free prep resets {formatLocalDate(resetAt)} at {formatLocalTime(resetAt)}
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
      {/* Header — always visible immediately */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Ace Your Next Interview
        </h1>
        <p className="text-lg text-muted-foreground">
          AI generates personalized interview questions in 30 seconds
        </p>
      </div>

      {/* Skeleton loading while auth / rate-limit resolves */}
      {(isRedirecting || checkingLimit) ? (
        <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm space-y-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      ) : (
        <>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Quick Tips - Mobile Only */}
          <QuickTips
            show={!results}
            tips={[
              "Paste the job description below",
              "Add your resume or background summary",
              "Get tailored interview questions in 30 seconds",
            ]}
          />

          {showEmailGate && !emailCaptured && !emailSkipped ? (
            <EmailCaptureGate
              source="interview-prep"
              sessionId={sessionId}
              isProcessing={isLoading}
              onEmailCaptured={(fullResults) => {
                setEmailCaptured(true);
                setShowEmailGate(false);
                if (fullResults) setResults({ ...fullResults, totalQuestions: fullResults.questions?.length || 0 });
              }}
              onSkip={() => { setEmailSkipped(true); setShowEmailGate(false); }}
            />
          ) : !results ? (
            <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm space-y-6">
              <SampleResultPreview variant="interview-prep" />
              <InterviewPrepForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          ) : emailCaptured ? (
            <div className="space-y-8">
              <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
                <InterviewPrepResults analysis={results} isPreview={false} />
              </div>
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResults(null);
                    setSessionId(null);
                    setEmailCaptured(false);
                    setEmailSkipped(false);
                    setShowEmailGate(false);
                    setError(null);
                  }}
                >
                  Try Another Job
                </Button>
              </div>
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

          {/* How It Works - Hidden on Mobile (shown via Quick Tips above) */}
          {!results && (
            <div className="hidden sm:block mt-12 p-6 bg-muted rounded-lg">
              <h3 className="font-semibold mb-4 text-center">How It Works</h3>
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                    1
                  </div>
                  <h4 className="font-medium mb-2">Paste Job Description</h4>
                  <p className="text-sm text-muted-foreground">Copy the job posting you&apos;re interviewing for</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                    2
                  </div>
                  <h4 className="font-medium mb-2">Share Your Background</h4>
                  <p className="text-sm text-muted-foreground">Paste your resume or write a brief summary</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                    3
                  </div>
                  <h4 className="font-medium mb-2">Get Interview Questions</h4>
                  <p className="text-sm text-muted-foreground">AI generates tailored questions in 30 seconds</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
