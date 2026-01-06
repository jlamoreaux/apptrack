"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

type PageState = "loading" | "success" | "error" | "not-from-extension";

interface TokenResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export default function ExtensionCallbackPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseAuth();
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Don't do anything while auth is loading
    if (authLoading) return;

    // Check if this page was opened from extension (has opener window)
    const hasOpener = typeof window !== "undefined" && window.opener !== null;

    // If user is not authenticated, redirect to login
    if (!user) {
      const redirectUrl = encodeURIComponent("/auth/extension-callback");
      router.push(`/login?redirect=${redirectUrl}`);
      return;
    }

    // If no opener window, show explanation
    if (!hasOpener) {
      setState("not-from-extension");
      return;
    }

    // User is authenticated and page was opened from extension
    // Generate token and send to extension
    generateAndSendToken();
  }, [user, authLoading, router]);

  async function generateAndSendToken() {
    try {
      setState("loading");

      // Call the extension token API
      const response = await fetch("/api/auth/extension-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate token");
      }

      const tokenData: TokenResponse = await response.json();

      // Send token to extension via postMessage
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "APPTRACK_AUTH_SUCCESS",
            token: tokenData.token,
            expiresAt: tokenData.expiresAt,
            user: tokenData.user,
          },
          "*" // Extensions don't have traditional origins
        );

        setState("success");

        // Auto-close after 2 seconds
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        // Opener closed unexpectedly
        throw new Error("Extension window was closed");
      }
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    }
  }

  function handleRetry() {
    if (window.opener) {
      generateAndSendToken();
    } else {
      setState("not-from-extension");
    }
  }

  function handleClose() {
    window.close();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          {state === "loading" && (
            <>
              <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <CardTitle className="text-2xl">Connecting Extension</CardTitle>
            </>
          )}

          {state === "success" && (
            <>
              <div className="mx-auto p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-fit">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">Successfully Connected</CardTitle>
            </>
          )}

          {state === "error" && (
            <>
              <div className="mx-auto p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Connection Failed</CardTitle>
            </>
          )}

          {state === "not-from-extension" && (
            <>
              <div className="mx-auto p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full w-fit">
                <ExternalLink className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-2xl">Extension Auth Page</CardTitle>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {state === "loading" && (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Generating secure token for the AppTrack extension...
              </p>
              <p className="text-sm text-muted-foreground">
                This window will close automatically.
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Your AppTrack extension is now connected to your account.
              </p>
              <p className="text-sm text-muted-foreground">
                This window will close automatically in a moment.
              </p>
              <Button onClick={handleClose} variant="outline" className="w-full">
                Close Window
              </Button>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {errorMessage || "Failed to connect to the extension"}
                </p>
              </div>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleClose} variant="outline" className="w-full">
                  Close Window
                </Button>
              </div>
            </div>
          )}

          {state === "not-from-extension" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-muted-foreground">
                  This page is used to connect the AppTrack browser extension to
                  your account.
                </p>
                <p className="text-sm text-muted-foreground">
                  To use this page, please open it from within the AppTrack
                  browser extension by clicking "Sign In".
                </p>
              </div>
              <Button
                onClick={() => router.push("/dashboard")}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
