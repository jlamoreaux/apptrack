"use client";

import { useEffect, useState } from "react";
import { AGENT_TOKEN_LIMITS } from "@/lib/constants/agent-access";
import { SITE_URL } from "@/lib/constants/site-config";
import type { AgentTokenRecord } from "@/types";
import { AgentTokenCreateForm } from "./agent-token-create-form";
import { AgentTokenList } from "./agent-token-list";
import { AgentTokenReveal } from "./agent-token-reveal";
import {
  fetchAgentTokens,
  revokeAgentToken,
  revokeAllAgentTokens,
  type CreatedAgentToken,
} from "./agent-tokens-api";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; tokens: AgentTokenRecord[] };

function markRevoked(token: AgentTokenRecord, revokedAt: string): AgentTokenRecord {
  if (token.revoked_at !== null) return token;
  return { ...token, revoked_at: revokedAt, status: "revoked" };
}

function ErrorText({ message }: { message: string }): React.JSX.Element {
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * Personal access tokens for MCP agents: list, create (shown once), revoke.
 * Talks only to the token API; the raw token is held in memory until "Done".
 */
export function ConnectedAgents({
  siteUrl = SITE_URL,
}: {
  siteUrl?: string;
}): React.JSX.Element {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadTokens(): Promise<void> {
      const result = await fetchAgentTokens();
      if (cancelled) return;
      setLoad(
        result.ok
          ? { kind: "ready", tokens: result.value }
          : { kind: "error", message: result.message }
      );
    }
    void loadTokens();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateTokens(update: (tokens: AgentTokenRecord[]) => AgentTokenRecord[]): void {
    setLoad((current) =>
      current.kind === "ready" ? { kind: "ready", tokens: update(current.tokens) } : current
    );
  }

  function handleCreated(created: CreatedAgentToken): void {
    updateTokens((tokens) => [created.record, ...tokens]);
    setRevealedToken(created.token);
  }

  async function runRevoke(
    call: () => ReturnType<typeof revokeAllAgentTokens>,
    affects: (token: AgentTokenRecord) => boolean
  ): Promise<void> {
    setBusy(true);
    setActionError("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    const revokedAt = new Date().toISOString();
    updateTokens((tokens) =>
      tokens.map((token) => (affects(token) ? markRevoked(token, revokedAt) : token))
    );
  }

  function handleRevoke(id: string): void {
    void runRevoke(() => revokeAgentToken(id), (token) => token.id === id);
  }

  function handleRevokeAll(): void {
    void runRevoke(revokeAllAgentTokens, () => true);
  }

  if (load.kind === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading connected agents...
      </p>
    );
  }
  if (load.kind === "error") return <ErrorText message={load.message} />;

  return (
    <div className="space-y-6">
      {revealedToken === null ? (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Create a token</h3>
          <p className="text-sm text-muted-foreground">
            Up to {AGENT_TOKEN_LIMITS.maxActivePerUser} active tokens. Scopes cannot be changed
            later; create a new token instead.
          </p>
          <AgentTokenCreateForm onCreated={handleCreated} />
        </div>
      ) : (
        <AgentTokenReveal
          token={revealedToken}
          siteUrl={siteUrl}
          onDone={() => setRevealedToken(null)}
        />
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Your agent tokens</h3>
        {actionError && <ErrorText message={actionError} />}
        <AgentTokenList
          tokens={load.tokens}
          busy={busy}
          onRevoke={handleRevoke}
          onRevokeAll={handleRevokeAll}
        />
      </div>
    </div>
  );
}
