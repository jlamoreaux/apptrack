"use client";

import { useState, useEffect } from "react";
import { JobFitForm, type JobFitFormData } from "@/components/try/job-fit-form";
import { JobFitResults } from "@/components/try/job-fit-results";
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
import { trackPreviewStarted, trackPreviewCompleted, trackRateLimitReached } from "@/lib/analytics/pre-registration-events";
import { trackCampaignPageViewed, trackCampaignAnalysisSubmitted } from "@/lib/analytics/campaign-events";
import { SignupGate } from "@/components/try/signup-gate";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { formatLocalDate, formatLocalTime } from "@/lib/utils/date";
import { useSearchParams } from "next/navigation";

export default function TryJobFitPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [emailSkipped, setEmailSkipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Redirect logged-in users to dashboard
  const isRedirecting = useAuthRedirect("job-fit");

  // Check rate limit
  const { canUse, isLoading: checkingLimit, resetAt } =
    usePreRegistrationRateLimit("job_fit");

  // Offer variant from URL (?offer=trial or ?offer=discount)
  const searchParams = useSearchParams();
  const offerParam = searchParams.get("offer");
  const isCampaignVisit = offerParam !== null;
  const offer: "trial" | "discount" = offerParam === "discount" ? "discount" : "trial";

  const offerCtaText = isCampaignVisit
    ? (offer === "discount"
        ? "Get 50% off for 3 months — $4.50/mo, then $9/mo"
        : "Start free — 14 days on us, then $9/mo")
    : "Sign Up Free to Unlock";

  const offerSignupHref = isCampaignVisit
    ? (offer === "discount"
        ? `/signup?intent=discount&promo=REDDIT50${sessionId ? `&session=${sessionId}` : ""}`
        : `/signup?intent=trial${sessionId ? `&session=${sessionId}` : ""}`)
    : sessionId
      ? `/signup?session=${sessionId}`
      : "/signup";

  const offerGoogleRedirect: string | undefined = isCampaignVisit
    ? sessionId
      ? `/try/unlock?session=${sessionId}`
      : (offer === "discount"
          ? "/onboarding/welcome?promo=REDDIT50"
          : "/onboarding/welcome?promo=REDDIT14")
    : undefined;

  // Track page view / preview started
  useEffect(() => {
    if (!checkingLimit && canUse) {
      trackPreviewStarted({
        feature_type: "job_fit",
        entry_point: document.referrer ? "referral" : "direct",
      });
    }
  }, [checkingLimit, canUse]);

  useEffect(() => {
    if (!checkingLimit && isCampaignVisit) {
      trackCampaignPageViewed(offer);
    }
  }, [checkingLimit, isCampaignVisit, offer]);

  const handleSubmit = async (formData: JobFitFormData) => {
    setIsLoading(true);
    setShowEmailGate(true);
    setError(null);
    const submitStartTime = Date.now();
    setStartTime(submitStartTime);

    if (isCampaignVisit) {
      trackCampaignAnalysisSubmitted(offer);
    }

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
          setShowEmailGate(false);
          trackRateLimitReached({
            feature_type: "job_fit",
            had_previous_session: true,
          });
        } else {
          setError(data.error || "Failed to generate analysis. Please try again.");
          setShowEmailGate(false);
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
            <h1 className="text-3xl font-bold mb-2">
              You&apos;ve Used Your Free Analysis
            </h1>
            <p className="text-lg text-muted-foreground">
              Sign up free to access all AI tools and track your job search!
            </p>
          </div>

          {resetAt && (
            <p className="text-sm text-muted-foreground">
              Your free analysis resets {formatLocalDate(resetAt)} at{" "}
              {formatLocalTime(resetAt)}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button size="lg" asChild>
              <Link href={offerSignupHref}>
                {isCampaignVisit
                  ? (offer === "discount" ? "Claim 50% Off" : "Start Free Trial")
                  : "Sign Up Free"}
              </Link>
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
          Before you apply — know if you&apos;re actually a fit.
        </h1>
        <p className="text-lg text-muted-foreground">
          Paste a job listing. Upload your resume. Get a score and specific gaps in 30 seconds.
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
          {/* Error Alert */}
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
              "Paste the full job description below",
              "Add your resume or background summary",
              "Get your fit analysis in 30 seconds",
            ]}
          />

          {/* Form, Email Gate, or Results */}
          {showEmailGate && !emailCaptured && !emailSkipped ? (
            <EmailCaptureGate
              source="job-fit"
              sessionId={sessionId}
              isProcessing={isLoading}
              onEmailCaptured={(fullResults) => {
                setEmailCaptured(true);
                setShowEmailGate(false);
                if (fullResults) setResults(fullResults);
              }}
              onSkip={() => { setEmailSkipped(true); setShowEmailGate(false); }}
            />
          ) : !results ? (
            <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm space-y-6">
              <SampleResultPreview variant="job-fit" />
              <JobFitForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          ) : emailCaptured ? (
            <div className="space-y-8">
              <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
                <JobFitResults analysis={results} isPreview={false} />
              </div>
              <div className="text-center">
                <Button variant="outline" onClick={() => {
                  setResults(null);
                  setSessionId(null);
                  setEmailCaptured(false);
                  setEmailSkipped(false);
                  setShowEmailGate(false);
                  setError(null);
                }}>
                  Analyze Another Job
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm">
                <JobFitResults analysis={results} isPreview={true} />
              </div>
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
                ctaText={offerCtaText}
                ctaHref={offerSignupHref}
                googleRedirectTo={offerGoogleRedirect}
                offerVariant={isCampaignVisit ? offer : undefined}
              />
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
                  <p className="text-sm text-muted-foreground">
                    Copy the job posting you&apos;re interested in
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                    2
                  </div>
                  <h4 className="font-medium mb-2">Share Your Background</h4>
                  <p className="text-sm text-muted-foreground">
                    Paste your resume or write a brief summary
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
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
        </>
      )}
    </div>
  );
}
