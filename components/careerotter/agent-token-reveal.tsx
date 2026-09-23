"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentSetupSnippets } from "./agent-setup-snippets";

const TOKEN_INPUT_ID = "agent-token-value";

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

/**
 * The raw token, shown once right after creation. It lives only in the parent's
 * state; "Done" clears it and nothing can bring it back.
 */
export function AgentTokenReveal({
  token,
  siteUrl,
  onDone,
}: {
  token: string;
  siteUrl: string;
  onDone: () => void;
}): React.JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copy(): Promise<void> {
    setCopyState((await copyToClipboard(token)) ? "copied" : "failed");
  }

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor={TOKEN_INPUT_ID}>Your new token</Label>
        <p className="text-sm text-muted-foreground">
          Copy it now. It will not be shown again.
        </p>
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

      <AgentSetupSnippets siteUrl={siteUrl} />

      <Button type="button" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
