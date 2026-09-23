"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentSectionHeading } from "./agent-access-shared";
import { AgentSetupSnippets } from "./agent-setup-snippets";

const TOKEN_INPUT_ID = "agent-token-value";
const REVEAL_HEADING_ID = "agent-token-reveal-heading";
const DONE_LABEL = "I've saved it";

type CopyState = "idle" | "copied" | "failed";

const COPY_MESSAGES = {
  copied: "Copied.",
  failed: "Copy failed. Select the token and copy it manually.",
} as const satisfies Record<Exclude<CopyState, "idle">, string>;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Absent on insecure origins and some embedded browsers.
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Asks before a reload or tab close while mounted, since the token cannot be shown again. */
function useConfirmBeforeUnload(): void {
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      // Older Chromium versions only prompt when returnValue is set.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}

/**
 * The raw token, shown once right after creation. It lives only in the parent's
 * state; "I've saved it" clears it and nothing can bring it back.
 */
export function AgentTokenReveal({
  token,
  appUrl,
  onDone,
}: {
  token: string;
  appUrl: string;
  onDone: () => void;
}): React.JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  useConfirmBeforeUnload();

  // The create form this replaces held focus; land on the heading so screen
  // readers announce the new panel instead of losing focus to the body.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copy(): Promise<void> {
    setCopyState((await copyToClipboard(token)) ? "copied" : "failed");
  }

  return (
    <section
      aria-labelledby={REVEAL_HEADING_ID}
      className="space-y-6 rounded-lg border p-4"
    >
      <div className="space-y-2">
        <AgentSectionHeading id={REVEAL_HEADING_ID} ref={headingRef}>
          Token created
        </AgentSectionHeading>
        <p className="text-sm text-muted-foreground">
          Copy it now. It will not be shown again.
        </p>
        <Label htmlFor={TOKEN_INPUT_ID}>Your new token</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={TOKEN_INPUT_ID}
            readOnly
            value={token}
            className="font-mono text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={() => void copy()}>
            Copy
          </Button>
        </div>
        <p
          aria-live="polite"
          className={copyState === "failed" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {copyState === "idle" ? "" : COPY_MESSAGES[copyState]}
        </p>
      </div>

      <AgentSetupSnippets appUrl={appUrl} />

      <Button type="button" onClick={onDone}>
        {DONE_LABEL}
      </Button>
    </section>
  );
}
