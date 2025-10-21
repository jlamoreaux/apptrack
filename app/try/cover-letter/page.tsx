"use client";

import { useState } from "react";
import { CoverLetterForm, type CoverLetterFormData } from "@/components/try/cover-letter-form";
import { CoverLetterResults } from "@/components/try/cover-letter-results";
import { usePreRegistrationRateLimit } from "@/lib/hooks/use-pre-registration-rate-limit";
import { getFingerprint } from "@/lib/utils/fingerprint";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TryCoverLetterPage() {
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CoverLetterFormData | null>(null);

  // Check rate limit
  const { canUse, isLoading: checkingLimit, resetAt } =
    usePreRegistrationRateLimit("cover_letter");

  const handleSubmit = async (data: CoverLetterFormData) => {
    setIsLoading(true);
    setError(null);
    setFormData(data);

    try {
      // Get browser fingerprint
      const fingerprint = await getFingerprint();

      // Call API
      const response = await fetch("/api/try/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fingerprint,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(responseData.message || "You've already used your free cover letter generator.");
        } else {
          setError(responseData.error || "Failed to generate cover letter. Please try again.");
        }
        return;
      }

      // Set results and session ID
      setResults(responseData.preview);
      setSessionId(responseData.sessionId);

      // Track event in PostHog
      if (window.posthog) {
        window.posthog.capture("try_cover_letter_completed", {
          company_name: data.companyName,
          has_role_name: !!data.roleName,
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
              You've Used Your Free Cover Letter
            </h1>
            <p className="text-lg text-muted-foreground">
              Sign up to get 1 more free cover letter + track your applications!
            </p>
          </div>

          {resetAt && (
            <p className="text-sm text-muted-foreground">
              Your free cover letter resets{" "}
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
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          AI Cover Letter Generator
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Get a professional cover letter written by AI in 30 seconds
        </p>
        <p className="text-sm text-muted-foreground">
          No signup required • Completely free
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
          <CoverLetterForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Results */}
          <div className="bg-white rounded-lg border p-6 sm:p-8 shadow-sm">
            <CoverLetterResults
              coverLetter={results.text}
              isPreview={true}
              companyName={formData?.companyName}
              roleName={formData?.roleName}
            />
          </div>

          {/* Signup Gate */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 p-8 text-center">
            <h3 className="text-2xl font-semibold mb-4">
              🎉 Your Cover Letter is Ready!
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sign up free to unlock:
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2 mb-8">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Full professionally-written cover letter</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Save and edit your cover letter</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Track this application</span>
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

          {/* Try Another */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                setResults(null);
                setSessionId(null);
                setError(null);
                setFormData(null);
              }}
            >
              Generate Another Cover Letter
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
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                1
              </div>
              <h4 className="font-medium mb-2">Enter Job Details</h4>
              <p className="text-sm text-muted-foreground">
                Paste the job description and company name
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                2
              </div>
              <h4 className="font-medium mb-2">Share Your Background</h4>
              <p className="text-sm text-muted-foreground">
                Paste your resume or describe your experience
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                3
              </div>
              <h4 className="font-medium mb-2">Get Your Cover Letter</h4>
              <p className="text-sm text-muted-foreground">
                AI writes a personalized cover letter instantly
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
