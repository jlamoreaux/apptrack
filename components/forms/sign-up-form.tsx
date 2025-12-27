"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpWithPassword } from "@/lib/actions";
import { signUpSchema, passwordRequirements } from "@/lib/actions/schemas";
import type { TrafficSource, TrafficSourceTrial } from "@/types/promo-codes";
import { getStoredTrafficSource } from "@/lib/utils/traffic-source";
import { toast } from "@/hooks/use-toast";
import { trackLinkedInSignup } from "@/lib/analytics/linkedin";
import { trackConversionEvent, CONVERSION_EVENTS } from "@/lib/analytics/conversion-events";

type SignUpFormData = z.infer<typeof signUpSchema>;

// Password criteria validation helper
function checkPasswordCriteria(password: string) {
  return {
    minLength: password.length >= passwordRequirements.minLength,
    hasUppercase: passwordRequirements.hasUppercase.test(password),
    hasLowercase: passwordRequirements.hasLowercase.test(password),
    hasNumber: passwordRequirements.hasNumber.test(password),
    hasSpecialChar: passwordRequirements.hasSpecialChar.test(password),
  };
}

// Password criteria display component
function PasswordCriteria({ criteria }: { criteria: ReturnType<typeof checkPasswordCriteria> }) {
  const criteriaList = [
    { 
      met: criteria.minLength, 
      label: `At least ${passwordRequirements.minLength} characters` 
    },
    { 
      met: criteria.hasUppercase, 
      label: "One uppercase letter" 
    },
    { 
      met: criteria.hasLowercase, 
      label: "One lowercase letter" 
    },
    { 
      met: criteria.hasNumber, 
      label: "One number" 
    },
    { 
      met: criteria.hasSpecialChar, 
      label: "One special character (!@#$%^&*...)" 
    },
  ];

  return (
    <div className="text-sm space-y-1 mt-2">
      <p className="text-muted-foreground font-medium">Password must contain:</p>
      <div className="space-y-1">
        {criteriaList.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {item.met ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={item.met ? "text-green-600" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignUpForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordCriteria, setPasswordCriteria] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const [showPasswordCriteria, setShowPasswordCriteria] = useState(false);
  const [trafficSource, setTrafficSource] = useState<TrafficSource | null>(null);
  const [trafficSourceTrial, setTrafficSourceTrial] = useState<TrafficSourceTrial | null>(null);
  const [hasTrialIntent, setHasTrialIntent] = useState(false);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  // Watch password field for real-time validation
  const watchedPassword = watch("password");

  useEffect(() => {
    if (watchedPassword) {
      setPasswordCriteria(checkPasswordCriteria(watchedPassword));
      setShowPasswordCriteria(true);
    } else {
      setShowPasswordCriteria(false);
    }
  }, [watchedPassword]);
  
  // Check for traffic source and session on mount
  useEffect(() => {
    const { source, trial } = getStoredTrafficSource();

    if (source) {
      setTrafficSource(source);
      if (trial) {
        setTrafficSourceTrial(trial);
      }
    }

    // Check if user came with trial intent or preview session
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("intent") === "ai-coach-trial") {
      setHasTrialIntent(true);
    }

    // Check for preview session ID (from try-before-signup flow)
    const sessionId = urlParams.get("session");
    if (sessionId) {
      setPreviewSessionId(sessionId);
    }
  }, []);

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signUpWithPassword(
        data.email,
        data.password,
        data.name,
        trafficSource || undefined,
        trafficSourceTrial || undefined
      );

      if (result.error) {
        setError(result.error);
      } else {
        // Track successful signup for analytics
        trackLinkedInSignup();
        trackConversionEvent(CONVERSION_EVENTS.SIGNUP_COMPLETED, {
          utm_source: trafficSource || undefined,
          referrer: typeof document !== "undefined" ? document.referrer : undefined,
        });

        // Store email and session for confirmation page (with error handling for private browsing)
        try {
          localStorage.setItem("pendingEmailConfirmation", data.email);
          if (previewSessionId) {
            localStorage.setItem("pendingPreviewSession", previewSessionId);
          }
        } catch (e) {
          console.warn("Could not save to localStorage:", e);
        }
        
        // Create Stripe customer if email is already verified
        if (!result.requiresEmailConfirmation) {
          try {
            // Wait for customer creation to complete before proceeding
            const customerResponse = await fetch("/api/stripe/create-customer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            
            if (!customerResponse.ok) {
              // Log error details but don't block user flow
              const errorData = await customerResponse.json().catch(() => ({}));
              console.error("Stripe customer creation failed:", {
                status: customerResponse.status,
                error: errorData.error || "Unknown error"
              });
              
              // Show warning toast but allow user to continue
              toast({
                title: "Payment setup incomplete",
                description: "You can complete payment setup later from your account settings.",
                variant: "default", // Use default, not destructive, since it's not blocking
              });
            }
          } catch (err) {
            // Network error - log but don't block user flow
            console.error("Failed to create Stripe customer:", err);
            toast({
              title: "Connection issue",
              description: "Payment setup will be completed when you first upgrade.",
              variant: "default",
            });
          }
        }
        
        // Check if email confirmation is required
        if (result.requiresEmailConfirmation) {
          // Redirect to email confirmation page
          router.push("/auth/confirm-email");
        } else {
          // If user came from preview session, redirect to unlock page
          if (previewSessionId) {
            router.push(`/try/unlock?session=${previewSessionId}`);
          }
          // If user has trial intent, add parameter to auto-select AI Coach
          else if (hasTrialIntent && trafficSourceTrial) {
            router.push("/onboarding/welcome?auto_select=ai_coach");
          }
          // Default: go to onboarding
          else {
            router.push("/onboarding/welcome");
          }
          router.refresh();
        }
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Collect all field errors into a single array
  const fieldErrors = [
    errors.name?.message,
    errors.email?.message,
    errors.password?.message,
    errors.confirmPassword?.message,
  ].filter(Boolean);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Single consolidated error display area */}
      {(error || fieldErrors.length > 0) && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md space-y-1">
          {error && <div>{error}</div>}
          {fieldErrors.map((fieldError, index) => (
            <div key={index}>{fieldError}</div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" type="text" {...register("name")} disabled={loading} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...register("password")}
          disabled={loading}
        />
        
        {/* Password criteria display with real-time validation */}
        <PasswordCriteria criteria={passwordCriteria} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          {...register("confirmPassword")}
          disabled={loading}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90"
        disabled={loading}
      >
        {loading ? "Creating Account..." : "Create Account"}
      </Button>
    </form>
  );
}