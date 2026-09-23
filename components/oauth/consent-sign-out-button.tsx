"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions";
import { OAUTH_CONSENT_COPY, OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";
import { loginHref } from "@/lib/utils/auth-redirect";
import { navigateTo } from "@/lib/utils/browser-navigation";

async function signOutSucceeded(): Promise<boolean> {
  try {
    return !("error" in (await signOut()));
  } catch {
    return false;
  }
}

/**
 * "Not you? Sign out": signs out, then opens login returning to this consent
 * page, so the right account can pick up the same request.
 */
export function ConsentSignOutButton({ consentPath }: { consentPath: string }): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut(): Promise<void> {
    setBusy(true);
    setFailed(false);
    if (await signOutSucceeded()) {
      navigateTo(loginHref(consentPath));
      return;
    }
    setBusy(false);
    setFailed(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="link"
        className="min-h-11 px-1"
        disabled={busy}
        onClick={() => void handleSignOut()}
      >
        {OAUTH_CONSENT_COPY.signOut}
      </Button>
      {failed && (
        <span role="alert" className="block text-sm text-destructive">
          {OAUTH_CONSENT_MESSAGES.retry}
        </span>
      )}
    </>
  );
}
