"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JobFitResults } from "@/components/try/job-fit-results";
import { CoverLetterResults } from "@/components/try/cover-letter-results";
import { InterviewPrepResults } from "@/components/try/interview-prep-results";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

/**
 * Unlock page - shown after user signs up from a preview session
 * Converts the session and shows full results
 */
export default function UnlockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [featureType, setFeatureType] = useState<string>("");
  const [inputData, setInputData] = useState<any>(null);

  useEffect(() => {
    const convertSession = async () => {
      if (!sessionId) {
        setError("No session ID provided");
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          // Redirect to signup with session ID
          router.push(`/signup?session=${sessionId}`);
          return;
        }

        // Convert the session
        const response = await fetch("/api/try/convert-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to unlock analysis");
          setIsLoading(false);
          return;
        }

        // Set the analysis data
        setAnalysis(data.analysis);
        setFeatureType(data.featureType);
        setInputData(data.inputData);
        setIsLoading(false);

        // Track in PostHog
        capturePostHogEvent("preview_unlocked", {
          feature_type: data.featureType,
          session_id: sessionId,
        });
      } catch (err) {
        console.error("Error converting session:", err);
        setError("An unexpected error occurred");
        setIsLoading(false);
      }
    };

    convertSession();
  }, [sessionId, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Unlocking your full analysis...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="mt-6 flex gap-4 justify-center">
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/try/job-fit">Try Again</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Success state - show full analysis
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 py-12">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-4xl font-bold mb-4">
          {featureType === "cover_letter" && "Full Cover Letter Unlocked!"}
          {featureType === "job_fit" && "Full Analysis Unlocked!"}
          {featureType === "interview_prep" && "Interview Questions Unlocked!"}
          {!["cover_letter", "job_fit", "interview_prep"].includes(featureType) && "Content Unlocked!"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {featureType === "job_fit" && "Here's your complete job fit analysis"}
          {featureType === "cover_letter" && "Here's your complete professional cover letter"}
          {featureType === "interview_prep" && "Here are all your personalized interview questions"}
        </p>
      </div>

      {/* Full Results - Job Fit */}
      {analysis && featureType === "job_fit" && (
        <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm mb-8">
          <JobFitResults analysis={analysis} isPreview={false} />
        </div>
      )}

      {/* Full Results - Cover Letter */}
      {analysis && featureType === "cover_letter" && (
        <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm mb-8">
          <CoverLetterResults
            coverLetter={analysis}
            isPreview={false}
            companyName={inputData?.companyName}
            roleName={inputData?.roleName}
          />
        </div>
      )}

      {/* Full Results - Interview Prep */}
      {analysis && featureType === "interview_prep" && (
        <div className="bg-card rounded-lg border p-6 sm:p-8 shadow-sm mb-8">
          <InterviewPrepResults analysis={analysis} isPreview={false} />
        </div>
      )}

      {/* Next Steps CTA */}
      <div className="bg-muted rounded-lg border p-8 text-center">
        <h3 className="text-2xl font-semibold mb-4">
          What's Next?
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Track this application and use AI Coach to help you throughout your job search
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/applications/new">Save as Application</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            As a free user, you get 1 free try of each AI feature:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="px-3 py-1 bg-card rounded-full text-xs font-medium border">
              Job Fit Analysis
            </span>
            <span className="px-3 py-1 bg-card rounded-full text-xs font-medium border">
              Cover Letter Generator
            </span>
            <span className="px-3 py-1 bg-card rounded-full text-xs font-medium border">
              Interview Prep
            </span>
            <span className="px-3 py-1 bg-card rounded-full text-xs font-medium border">
              Resume Review
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
