"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { trackSignupClicked, type PreRegFeatureType } from "@/lib/analytics/pre-registration-events";

interface SignupGateBenefit {
  text: string;
}

interface SignupGateProps {
  featureType: PreRegFeatureType;
  sessionId?: string | null;
  title?: string;
  benefits: SignupGateBenefit[];
  ctaText?: string;
}

const DEFAULT_BENEFITS: SignupGateBenefit[] = [
  { text: "Save and access your results anytime" },
  { text: "Track all your job applications" },
  { text: "Try all AI features free once" },
];

export function SignupGate({
  featureType,
  sessionId,
  title = "Your Results Are Ready!",
  benefits = DEFAULT_BENEFITS,
  ctaText = "Sign Up Free to Unlock",
}: SignupGateProps) {
  const handleSignupClick = () => {
    trackSignupClicked({
      feature_type: featureType,
      session_id: sessionId || undefined,
      cta_location: "preview_card",
    });
  };

  return (
    <div className="bg-muted rounded-xl border p-6 sm:p-8">
      <div className="text-center max-w-md mx-auto">
        <h3 className="text-xl sm:text-2xl font-semibold mb-4">{title}</h3>

        <p className="text-muted-foreground mb-6">Sign up free to unlock:</p>

        <ul className="text-left space-y-3 mb-8">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="text-green-600 text-lg leading-none mt-0.5">✓</span>
              <span className="text-sm sm:text-base">{benefit.text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-4">
          <Button
            size="lg"
            className="w-full h-12 min-h-[48px] text-base"
            asChild
            onClick={handleSignupClick}
          >
            <Link href={sessionId ? `/signup?session=${sessionId}` : "/signup"}>
              {ctaText}
            </Link>
          </Button>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="underline hover:text-primary font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
