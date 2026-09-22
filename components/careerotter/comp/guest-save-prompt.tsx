"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";

export const COMP_AFTER_AUTH_PATH = "/dashboard/comp";

interface GuestSavePromptProps {
  entryCount: number;
}

/**
 * Shown on the guest comp page once there is something worth keeping. The
 * entries are already in this browser; signing up or logging in saves them
 * to the account automatically, so the ask is one click, not re-entry.
 */
export function GuestSavePrompt({ entryCount }: GuestSavePromptProps) {
  const noun = entryCount === 1 ? "entry" : "entries";
  const redirect = encodeURIComponent(COMP_AFTER_AUTH_PATH);
  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Keep this</h2>
          <p className="text-sm text-muted-foreground">
            Your {entryCount} {noun} {entryCount === 1 ? "lives" : "live"} only in this browser,
            for the next 24 hours. Create a free account and we save {entryCount === 1 ? "it" : "them"}{" "}
            for you, along with live prices and your history over time.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <GoogleSignInButton
            context="signup"
            redirectTo={COMP_AFTER_AUTH_PATH}
            size="default"
            className="min-h-[44px] w-full"
          />
          <ButtonLink href={`/signup?redirectTo=${redirect}`} className="min-h-[44px] w-full">
            Sign up free
          </ButtonLink>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={`/login?redirectTo=${redirect}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
