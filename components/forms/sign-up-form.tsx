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
  const [trafficSource, setTrafficSource] = useState<string | null>(null);
  const [trafficSourceTrial, setTrafficSourceTrial] = useState<{ days: number; type: string } | null>(null);
  const [hasTrialIntent, setHasTrialIntent] = useState(false);
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
  
  // Check for traffic source on mount
  useEffect(() => {
    const source = sessionStorage.getItem("traffic_source");
    const trialData = sessionStorage.getItem("traffic_source_trial");
    
    if (source) {
      setTrafficSource(source);
      if (trialData) {
        try {
          setTrafficSourceTrial(JSON.parse(trialData));
        } catch (e) {
          console.error("Failed to parse trial data:", e);
        }
      }
    }
    
    // Check if user came with trial intent
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("intent") === "ai-coach-trial") {
      setHasTrialIntent(true);
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
        // Store email for confirmation page (with error handling for private browsing)
        try {
          localStorage.setItem("pendingEmailConfirmation", data.email);
        } catch (e) {
          console.warn("Could not save to localStorage:", e);
        }
        
        // Create Stripe customer in the background (don't wait for it)
        if (!result.requiresEmailConfirmation) {
          // Only create customer if email is already verified
          fetch("/api/stripe/create-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).catch(err => {
            console.error("Failed to create Stripe customer:", err);
          });
        }
        
        // Check if email confirmation is required
        if (result.requiresEmailConfirmation) {
          // Redirect to email confirmation page
          router.push("/auth/confirm-email");
        } else {
          // If already confirmed (e.g., in dev mode), go to onboarding
          // If user has trial intent, add parameter to auto-select AI Coach
          if (hasTrialIntent && trafficSourceTrial) {
            router.push("/onboarding/welcome?auto_select=ai_coach");
          } else {
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