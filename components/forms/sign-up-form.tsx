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

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signUpWithPassword(
        data.email,
        data.password,
        data.name
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
        
        // Check if email confirmation is required
        if (result.requiresEmailConfirmation) {
          // Redirect to email confirmation page
          router.push("/auth/confirm-email");
        } else {
          // If already confirmed (e.g., in dev mode), go to onboarding
          router.push("/onboarding/welcome");
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
        <div className="text-sm space-y-1 mt-2">
          <p className="text-muted-foreground font-medium">Password must contain:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {passwordCriteria.minLength ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={passwordCriteria.minLength ? "text-green-600" : "text-muted-foreground"}>
                At least {passwordRequirements.minLength} characters
              </span>
            </div>
            <div className="flex items-center gap-2">
              {passwordCriteria.hasUppercase ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={passwordCriteria.hasUppercase ? "text-green-600" : "text-muted-foreground"}>
                One uppercase letter
              </span>
            </div>
            <div className="flex items-center gap-2">
              {passwordCriteria.hasLowercase ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={passwordCriteria.hasLowercase ? "text-green-600" : "text-muted-foreground"}>
                One lowercase letter
              </span>
            </div>
            <div className="flex items-center gap-2">
              {passwordCriteria.hasNumber ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={passwordCriteria.hasNumber ? "text-green-600" : "text-muted-foreground"}>
                One number
              </span>
            </div>
            <div className="flex items-center gap-2">
              {passwordCriteria.hasSpecialChar ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={passwordCriteria.hasSpecialChar ? "text-green-600" : "text-muted-foreground"}>
                One special character (!@#$%^&*...)
              </span>
            </div>
          </div>
        </div>
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