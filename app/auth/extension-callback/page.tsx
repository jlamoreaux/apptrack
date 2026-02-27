"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import type { ExtensionTokenResponse } from "@/types";

// Chrome extension IDs are exactly 32 lowercase characters from [a-p]
const EXTENSION_ID_REGEX = /^[a-p]{32}$/;

const isDev = process.env.NODE_ENV === "development";

// Timing constants
const EXTENSION_MESSAGE_TIMEOUT_MS = 10000;
const AUTO_CLOSE_DELAY_MS = 2000;

// Type definitions for extension messaging
type ExtensionAuthMessage = {
  type: "AUTH_CALLBACK";
  payload: {
    token: string;
    expiresAt: string;
    userId: string;
    email: string;
  };
};

type ExtensionResponse = {
  success: boolean;
  error?: string;
};

// Type for Chrome runtime API (subset we actually use)
type ChromeRuntime = {
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

/**
 * Validate that a string is a valid Chrome extension ID format.
 */
function isValidExtensionId(id: string): boolean {
  return EXTENSION_ID_REGEX.test(id);
}

/**
 * Get the extension ID for chrome.runtime.sendMessage communication.
 * In production, requires NEXT_PUBLIC_EXTENSION_ID environment variable.
 * In development, also accepts extensionId from URL params for local testing.
 */
function getExtensionId(): string | null {
  // Check environment variable first (required in production)
  const envExtensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
  if (envExtensionId) {
    if (!isValidExtensionId(envExtensionId)) {
      if (isDev) console.error("[AppTrack] Invalid extension ID format in NEXT_PUBLIC_EXTENSION_ID");
      return null;
    }
    return envExtensionId;
  }

  // Only allow URL params in development mode to prevent token interception attacks
  // In production, NEXT_PUBLIC_EXTENSION_ID must be set
  if (typeof window !== "undefined" && isDev) {
    const params = new URLSearchParams(window.location.search);
    const paramExtensionId = params.get("extensionId");
    if (paramExtensionId) {
      if (!isValidExtensionId(paramExtensionId)) {
        console.error("[AppTrack] Invalid extension ID format in URL parameter");
        return null;
      }
      console.warn("[AppTrack] Using extension ID from URL parameter - development mode only");
      return paramExtensionId;
    }
  }

  return null;
}

/**
 * Type guard to validate response matches ExtensionResponse shape.
 */
function isExtensionResponse(response: unknown): response is ExtensionResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const obj = response as Record<string, unknown>;
  return (
    typeof obj.success === "boolean" &&
    (obj.error === undefined || typeof obj.error === "string")
  );
}

/**
 * Send message to extension using chrome.runtime.sendMessage.
 * This is the proper way to communicate with extensions from web pages.
 * Includes a timeout to prevent indefinite hangs if extension doesn't respond.
 */
async function sendMessageToExtension(
  extensionId: string,
  message: ExtensionAuthMessage,
  timeoutMs = EXTENSION_MESSAGE_TIMEOUT_MS
): Promise<ExtensionResponse> {
  return Promise.race([
    new Promise<ExtensionResponse>((resolve) => {
      // chrome.runtime API is only available in Chrome/Chromium-based browsers (Edge, Brave, etc.)
      // Firefox uses browser.runtime and Safari has limited extension support
      // The extension must also declare externally_connectable in its manifest
      const chromeRuntime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;

      if (!chromeRuntime?.sendMessage) {
        resolve({ success: false, error: "Chrome runtime not available. Please use Chrome or a Chromium-based browser." });
        return;
      }

      chromeRuntime.sendMessage(extensionId, message, (response: unknown) => {
        if (chromeRuntime.lastError) {
          resolve({
            success: false,
            error: chromeRuntime.lastError.message || "Failed to send message to extension"
          });
          return;
        }

        if (!response) {
          resolve({ success: false, error: "No response from extension" });
          return;
        }

        if (isExtensionResponse(response)) {
          resolve(response);
        } else {
          resolve({ success: false, error: "Invalid response from extension" });
        }
      });
    }),
    new Promise<ExtensionResponse>((resolve) =>
      setTimeout(() => resolve({ success: false, error: "Extension did not respond in time" }), timeoutMs)
    ),
  ]);
}

type PageState = "loading" | "success" | "error" | "not-from-extension";

export default function ExtensionCallbackPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseAuth();
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Don't do anything while auth is loading
    if (authLoading) return;

    // If user is not authenticated, redirect to login
    if (!user) {
      const redirectUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(`/login?redirect=${redirectUrl}`);
      return;
    }

    // Check if we have an extension ID to communicate with
    const extensionId = getExtensionId();
    if (!extensionId) {
      setState("not-from-extension");
      return;
    }

    // User is authenticated and we have extension ID
    // Generate token and send to extension
    const abortController = new AbortController();
    let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

    async function generateAndSendToken(extId: string) {
      try {
        setState("loading");

        // Call the extension token API
        const response = await fetch("/api/auth/extension-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorMsg = "Failed to generate token";
          try {
            const data = await response.json();
            errorMsg = data.error || errorMsg;
          } catch {
            // Response wasn't JSON, use default message
          }
          throw new Error(errorMsg);
        }

        const tokenData: ExtensionTokenResponse = await response.json();

        // Send token to extension via chrome.runtime.sendMessage
        const result = await sendMessageToExtension(extId, {
          type: "AUTH_CALLBACK",
          payload: {
            token: tokenData.token,
            expiresAt: tokenData.expiresAt,
            userId: tokenData.user.id,
            email: tokenData.user.email,
          },
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to send token to extension");
        }

        setState("success");

        // Auto-close after delay
        autoCloseTimeout = setTimeout(() => {
          window.close();
        }, AUTO_CLOSE_DELAY_MS);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "An unexpected error occurred"
        );
      }
    }

    generateAndSendToken(extensionId);

    return () => {
      abortController.abort();
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
      }
    };
  }, [user, authLoading, router]);

  async function handleRetry() {
    const extensionId = getExtensionId();
    if (!extensionId) {
      setState("not-from-extension");
      return;
    }

    try {
      setState("loading");

      const response = await fetch("/api/auth/extension-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorMsg = "Failed to generate token";
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response wasn't JSON, use default message
        }
        throw new Error(errorMsg);
      }

      const tokenData: ExtensionTokenResponse = await response.json();

      const result = await sendMessageToExtension(extensionId, {
        type: "AUTH_CALLBACK",
        payload: {
          token: tokenData.token,
          expiresAt: tokenData.expiresAt,
          userId: tokenData.user.id,
          email: tokenData.user.email,
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send token to extension");
      }

      setState("success");

      setTimeout(() => {
        window.close();
      }, AUTO_CLOSE_DELAY_MS);
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
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
