"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AGENT_TOKEN_LIMITS } from "@/lib/constants/agent-access";
import {
  fetchAgentTokens,
  revokeAgentToken,
  revokeAllAgentTokens,
  type ApiFailure,
  type ApiResult,
  type CreatedAgentToken,
} from "@/lib/client/agent-tokens.client";
import type { AgentTokenRecord } from "@/types";
import { AgentAccessError, AgentSectionHeading } from "./agent-access-shared";
import { AgentTokenCreateForm } from "./agent-token-create-form";
import { AgentTokenList } from "./agent-token-list";
import { AgentTokenReveal } from "./agent-token-reveal";

const HEADING_IDS = {
  create: "agent-token-create-heading",
  list: "agent-token-list-heading",
} as const;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; failure: ApiFailure }
  | { kind: "ready"; tokens: AgentTokenRecord[] };

type FocusTarget = keyof typeof HEADING_IDS;

function LoadFailure({
  failure,
  onRetry,
}: {
  failure: ApiFailure;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <AgentAccessError failure={failure} />
      {failure.reason !== "unauthorized" && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Personal access tokens for MCP agents: list, create (shown once), revoke.
 * Talks only to the token API; the raw token is held in memory until the user
 * confirms they saved it.
 */
export function ConnectedAgents({ appUrl }: { appUrl: string }): React.JSX.Element {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiFailure | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const createHeadingRef = useRef<HTMLHeadingElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);

  const loadTokens = useCallback(async (): Promise<void> => {
    setLoad({ kind: "loading" });
    const result = await fetchAgentTokens();
    if (!mountedRef.current) return;
    setLoad(result.ok ? { kind: "ready", tokens: result.value } : { kind: "error", failure: result });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadTokens();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTokens]);

  // Runs after the render that mounts the target heading, so the ref is set.
  useEffect(() => {
    if (focusTarget === null) return;
    const ref = focusTarget === "create" ? createHeadingRef : listHeadingRef;
    ref.current?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  // The server may change more than the row acted on (create revokes an
  // expired token holding the same name), so re-read rather than patch.
  async function refreshTokens(): Promise<void> {
    const result = await fetchAgentTokens();
    if (!mountedRef.current) return;
    if (result.ok) setLoad({ kind: "ready", tokens: result.value });
    else setActionError(result);
  }

  function handleCreated(created: CreatedAgentToken): void {
    setActionError(null);
    setRevealedToken(created.token);
    void refreshTokens();
  }

  function handleRevealDone(): void {
    setRevealedToken(null);
    setFocusTarget("create");
  }

  async function runRevoke(call: () => Promise<ApiResult<true>>): Promise<void> {
    setBusy(true);
    setActionError(null);
    const result = await call();
    if (!mountedRef.current) return;
    if (!result.ok) {
      setActionError(result);
      setBusy(false);
      return;
    }
    await refreshTokens();
    setBusy(false);
    setFocusTarget("list");
  }

  if (load.kind === "loading") {
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Loading connected agents...
      </p>
    );
  }
  if (load.kind === "error") {
    return <LoadFailure failure={load.failure} onRetry={() => void loadTokens()} />;
  }

  return (
    <div className="space-y-6">
      {revealedToken === null ? (
        <section aria-labelledby={HEADING_IDS.create} className="space-y-2">
          <AgentSectionHeading id={HEADING_IDS.create} ref={createHeadingRef}>
            Create a token
          </AgentSectionHeading>
          <p className="text-sm text-muted-foreground">
            Up to {AGENT_TOKEN_LIMITS.maxActivePerUser} active tokens. Scopes cannot be changed
            later; create a new token instead.
          </p>
          <AgentTokenCreateForm onCreated={handleCreated} />
        </section>
      ) : (
        <AgentTokenReveal token={revealedToken} appUrl={appUrl} onDone={handleRevealDone} />
      )}

      <section aria-labelledby={HEADING_IDS.list} className="space-y-3">
        <AgentSectionHeading id={HEADING_IDS.list} ref={listHeadingRef}>
          Your agent tokens
        </AgentSectionHeading>
        {actionError && <AgentAccessError failure={actionError} />}
        <AgentTokenList
          tokens={load.tokens}
          busy={busy}
          onRevoke={(id) => void runRevoke(() => revokeAgentToken(id))}
          onRevokeAll={() => void runRevoke(revokeAllAgentTokens)}
        />
      </section>
    </div>
  );
}
