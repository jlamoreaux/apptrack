"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidInternalPath } from "@/lib/utils/internal-path";
import { APP_ROUTES, AUTH_REDIRECT_TO_PARAM } from "@/lib/constants/routes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword } from "@/lib/actions";
import Link from "next/link";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInFormData = z.infer<typeof signInSchema>;

/**
 * Where to go after signing in. The page that sent the user here comes first
 * (the middleware sets redirectTo when it bounces a protected page, the guest
 * comp page sets it to return there, and an app connection sets it to its
 * consent page); a new user without one goes to onboarding; everyone else to
 * the dashboard.
 */
async function afterSignInPath(userId: string): Promise<string> {
  const requested = new URLSearchParams(window.location.search).get(AUTH_REDIRECT_TO_PARAM);
  if (isValidInternalPath(requested)) return requested;
  try {
    const response = await fetch("/api/auth/check-new-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const { needsOnboarding } = await response.json();
    return needsOnboarding ? APP_ROUTES.ONBOARDING_WELCOME : APP_ROUTES.DASHBOARD.ROOT;
  } catch {
    return APP_ROUTES.DASHBOARD.ROOT;
  }
}

export function SignInForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPassword(data.email, data.password);

      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        router.push(await afterSignInPath(result.user.id));
        router.refresh();
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          {error}
          {error.includes("Email not confirmed") && (
            <div className="mt-2">
              <p className="text-xs">
                Please check your email and click the confirmation link.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          disabled={loading}
        />
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          disabled={loading}
        />
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={loading}
      >
        {loading ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
}
