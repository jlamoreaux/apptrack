"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ROAST_EVENTS,
  useRoastAnalytics,
  type RoastSignupPlacement,
} from "@/lib/roast/analytics";

// Signup URL carrying UTM params so roast-attributed signups are queryable
// via the existing apptrack_utm cookie mechanism (written by useUTMTracking
// on the signup page, read server-side at /auth/callback for user_signed_up).
export const ROAST_SIGNUP_URL =
  "/signup?utm_source=roast&utm_medium=results_page&utm_campaign=roast_funnel";

// Non-creator viewing a shared roast. Distinct medium so these conversions
// don't inflate the creator results-page funnel the P0 fix is measuring.
export const ROAST_VISITOR_SIGNUP_URL =
  "/signup?utm_source=roast&utm_medium=visitor_view&utm_campaign=roast_funnel";

const SIGNUP_BENEFITS = [
  "Save this roast to your account",
  "Track your applications in one place",
  "Get targeted improvement tips",
] as const;

interface RoastConversionModuleProps {
  roastId: string;
}

/**
 * Value-forward signup module shown to the roast creator directly after the
 * score/summary section — the primary conversion point on the results page.
 */
export function RoastConversionModule({ roastId }: RoastConversionModuleProps) {
  const router = useRouter();
  const { trackEvent } = useRoastAnalytics();

  const handleSignupClick = () => {
    trackEvent(ROAST_EVENTS.SIGNUP_CLICKED, {
      roastId,
      source: "results_page",
      placement: "after_score" satisfies RoastSignupPlacement,
    });
    router.push(ROAST_SIGNUP_URL);
  };

  return (
    <Card className="p-6 mb-6 border-primary/20 bg-primary/5">
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-semibold text-center mb-4">
          Make This Roast Count
        </h2>
        <ul className="space-y-2 mb-6">
          {SIGNUP_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <Check
                className="h-5 w-5 text-primary mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{benefit}</span>
            </li>
          ))}
        </ul>
        <div className="text-center">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={handleSignupClick}
          >
            Sign up free
          </Button>
        </div>
      </div>
    </Card>
  );
}
