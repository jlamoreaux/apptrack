"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NavigationStatic } from "@/components/navigation-static";
import { SignUpForm } from "@/components/forms/sign-up-form";
import { Gift, Sparkles } from "lucide-react";

export default function SignUpPageClient() {
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const sessionId = searchParams.get("session");
  const isAICoachTrial = intent === "ai-coach-trial";
  const hasPreviewSession = !!sessionId;
  
  useEffect(() => {
    // Check if we have traffic source trial info in session storage
    const trafficSource = sessionStorage.getItem("traffic_source");
    const trialData = sessionStorage.getItem("traffic_source_trial");
    
    if (isAICoachTrial && trafficSource && trialData) {
      // Trial info is already stored, user will get it after signup
      console.log("AI Coach trial ready for:", trafficSource);
    }
  }, [isAICoachTrial]);

  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <div className="container mx-auto px-4 flex items-center justify-center min-h-[calc(100vh-3.5rem)] py-8">
        <div className="w-full max-w-md space-y-4">
          {hasPreviewSession && (
            <Alert className="border-indigo-500 bg-indigo-50">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <AlertDescription className="text-sm">
                <strong>Your analysis is ready!</strong> Sign up to unlock the full results
              </AlertDescription>
            </Alert>
          )}

          {isAICoachTrial && !hasPreviewSession && (
            <Alert className="border-secondary bg-secondary/10">
              <Gift className="h-4 w-4 text-secondary" />
              <AlertDescription className="text-sm">
                <strong>7-Day AI Coach Trial</strong> - Sign up now to start your free trial!
              </AlertDescription>
            </Alert>
          )}
          
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                {(isAICoachTrial || hasPreviewSession) && (
                  <div className="p-2 bg-secondary/10 rounded-full">
                    <Sparkles className="h-6 w-6 text-secondary" />
                  </div>
                )}
              </div>
              <CardTitle>
                {hasPreviewSession
                  ? "Unlock Your Full Analysis"
                  : isAICoachTrial
                    ? "Start Your Free Trial"
                    : "Join AppTrack"
                }
              </CardTitle>
              <CardDescription>
                {hasPreviewSession
                  ? "Create your account to see the complete results + get 1 free try of each AI feature"
                  : isAICoachTrial
                    ? "Create your account to begin your 7-day AI Coach trial"
                    : "Create your account to start tracking job applications"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignUpForm />
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}