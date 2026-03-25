"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm } from "@/components/forms/sign-up-form";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { Gift, Sparkles, HeartHandshake, Tag } from "lucide-react";

export default function SignUpPageClient() {
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const sessionId = searchParams.get("session");
  const isAICoachTrial = intent === "ai-coach-trial";
  const isLayoffOffer = intent === "layoff-offer";
  const isTrialOffer = intent === "trial";
  const isDiscountOffer = intent === "discount";
  const promoFromUrl = searchParams.get("promo");
  const hasPreviewSession = !!sessionId;
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    // Check if we have traffic source trial info in session storage
    const trafficSource = sessionStorage.getItem("traffic_source");
    const trialData = sessionStorage.getItem("traffic_source_trial");

    if (isAICoachTrial && trafficSource && trialData) {
      // Trial info is already stored, user will get it after signup
      console.log("AI Coach trial ready for:", trafficSource);
    }

    // Store promo code unconditionally so it survives email confirmation redirects
    // even if the user never expands the email form (e.g. chose Google OAuth)
    if (isLayoffOffer) {
      try {
        localStorage.setItem("pendingPromoCode", "NEWSTART");
      } catch (e) {
        console.warn("Could not save pendingPromoCode to localStorage:", e);
      }
    }

    if (isTrialOffer) {
      try {
        localStorage.setItem("pendingPromoCode", "REDDIT14");
      } catch (e) {
        console.warn("Could not save pendingPromoCode to localStorage:", e);
      }
    }

    if (isDiscountOffer) {
      try {
        localStorage.setItem("pendingPromoCode", promoFromUrl ?? "REDDIT50");
      } catch (e) {
        console.warn("Could not save pendingPromoCode to localStorage:", e);
      }
    }
  }, [isAICoachTrial, isLayoffOffer, isTrialOffer, isDiscountOffer, promoFromUrl]);

  return (
    <AuthLayout>
      <div className="space-y-4">
        {hasPreviewSession && (
          <Alert className="border-indigo-50 dark:border-indigo-400">
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="text-sm text-indigo-900 dark:text-indigo-100">
              <strong>Your analysis is ready!</strong> Sign up to unlock the
              full results
            </AlertDescription>
          </Alert>
        )}

        {isAICoachTrial && !hasPreviewSession && (
          <Alert className="border-secondary bg-secondary/10">
            <Gift className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-sm">
              <strong>7-Day AI Coach Trial</strong> - Sign up now to start
              your free trial!
            </AlertDescription>
          </Alert>
        )}

        {isLayoffOffer && !hasPreviewSession && (
          <Alert className="border-secondary bg-secondary/10">
            <HeartHandshake className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-sm">
              <strong>Free 30-Day AI Coach Access</strong> — We&apos;re here to help
              you land your next role.
            </AlertDescription>
          </Alert>
        )}

        {isTrialOffer && !hasPreviewSession && (
          <Alert className="border-secondary bg-secondary/10">
            <Sparkles className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-sm">
              <strong>14 days free</strong> — then $9/mo. Cancel anytime.
            </AlertDescription>
          </Alert>
        )}

        {isDiscountOffer && !hasPreviewSession && (
          <Alert className="border-secondary bg-secondary/10">
            <Tag className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-sm">
              <strong>50% off for 3 months</strong> — $4.50/mo, then $9/mo.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              {(isAICoachTrial || isLayoffOffer || hasPreviewSession || isTrialOffer || isDiscountOffer) && (
                <div className="p-2 bg-secondary/10 rounded-full">
                  {isLayoffOffer ? (
                    <HeartHandshake className="h-6 w-6 text-secondary" />
                  ) : isDiscountOffer ? (
                    <Tag className="h-6 w-6 text-secondary" />
                  ) : (
                    <Sparkles className="h-6 w-6 text-secondary" />
                  )}
                </div>
              )}
            </div>
            <CardTitle>
              {isTrialOffer
                ? "Start Your Free Trial"
                : isDiscountOffer
                ? "Claim Your Discount"
                : hasPreviewSession
                ? "Unlock Your Full Analysis"
                : isLayoffOffer
                ? "Claim Your Free Month"
                : isAICoachTrial
                ? "Start Your Free Trial"
                : "Join AppTrack"}
            </CardTitle>
            <CardDescription>
              {isTrialOffer
                ? "Create your account to start your 14-day free trial"
                : isDiscountOffer
                ? "Create your account to activate 50% off for 3 months"
                : hasPreviewSession
                ? "Create your account to see the complete results + get 1 free try of each AI feature"
                : isLayoffOffer
                ? "Create your account to activate 30 days of AI Coach — free"
                : isAICoachTrial
                ? "Create your account to begin your 7-day AI Coach trial"
                : "Create your account to start tracking job applications"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleSignInButton
              context="signup"
              redirectTo={
                sessionId
                  ? `/try/unlock?session=${encodeURIComponent(sessionId)}`
                  : isLayoffOffer
                  ? "/onboarding/welcome?promo=NEWSTART"
                  : isDiscountOffer
                  ? "/onboarding/welcome?promo=REDDIT50"
                  : isTrialOffer
                  ? "/onboarding/welcome?promo=REDDIT14"
                  : undefined
              }
              className="mb-4"
            />

            {!showEmailForm ? (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="inline-flex min-h-11 items-center justify-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Continue with email →
                </button>
              </div>
            ) : (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                  </div>
                </div>
                <SignUpForm />
              </>
            )}
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
