"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(false);

  useEffect(() => {
    // Get email from localStorage (set during signup)
    const storedEmail = localStorage.getItem("pendingEmailConfirmation");
    if (storedEmail) {
      setEmail(storedEmail);
    }
    
    // If user is already authenticated (email confirmed), redirect
    if (!authLoading && user) {
      // Clear the pending email confirmation
      localStorage.removeItem("pendingEmailConfirmation");
      // Check if they need onboarding
      checkUserOnboardingStatus();
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const checkUserOnboardingStatus = async (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;
    
    try {
      const response = await fetch("/api/auth/check-new-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      
      const { needsOnboarding } = await response.json();
      
      if (needsOnboarding) {
        router.push("/onboarding/welcome");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      // Default to dashboard if check fails
      router.push("/dashboard");
    }
  };

  const handleCheckConfirmation = async () => {
    setCheckingAuth(true);
    setResendError(null); // Clear any previous errors
    
    try {
      // Check if the user is authenticated
      const response = await fetch("/api/auth/check-session", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        // User is now authenticated, clear storage and redirect
        localStorage.removeItem("pendingEmailConfirmation");
        await checkUserOnboardingStatus(data.user.id);
      } else {
        // Not confirmed yet, show a message
        setResendError("Email not yet confirmed. Please check your inbox and click the confirmation link.");
        setCheckingAuth(false);
      }
    } catch (error) {
      setResendError("Unable to verify confirmation status. Please try again.");
      setCheckingAuth(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email || countdown > 0) return;

    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendSuccess(true);
        setCountdown(60); // 60 second cooldown
      } else {
        setResendError(data.error || "Failed to resend confirmation email");
      }
    } catch (error) {
      setResendError("An error occurred while resending the email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              We've sent a confirmation email to:
            </p>
            {email && (
              <p className="font-semibold text-lg">{email}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Please click the link in the email to activate your account.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Didn't receive the email?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 ml-6">
              <li>• Check your spam or junk folder</li>
              <li>• Make sure you entered the correct email address</li>
              <li>• Wait a few minutes for the email to arrive</li>
            </ul>
          </div>

          {resendSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <p className="text-sm font-medium">
                  Confirmation email resent successfully!
                </p>
              </div>
            </div>
          )}

          {resendError && (
            <div className={`border rounded-lg p-3 ${
              resendError.includes("not yet confirmed") 
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            }`}>
              <div className={`flex items-center gap-2 ${
                resendError.includes("not yet confirmed")
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-red-700 dark:text-red-400"
              }`}>
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm font-medium">{resendError}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleResendEmail}
              disabled={resending || countdown > 0 || !email}
              className="w-full"
              variant="outline"
            >
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : countdown > 0 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend in {countdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend Confirmation Email
                </>
              )}
            </Button>

            <Button
              onClick={handleCheckConfirmation}
              disabled={checkingAuth}
              className="w-full"
            >
              {checkingAuth ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "I've Confirmed My Email"
              )}
            </Button>
          </div>

          <div className="text-center space-y-2 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Wrong email address?
            </p>
            <Link 
              href="/signup" 
              className="text-sm text-primary hover:underline"
            >
              Sign up with a different email
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}