"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AGENT_TOKEN_LIMITS } from "@/lib/constants/agent-access";
import { REVOKE_ALL_COPY } from "@/lib/constants/agent-access-ui";
import {
  fetchAgentTokens,
  revokeAgentToken,
  revokeAllAgentTokens,
  type CreatedAgentToken,
} from "@/lib/client/agent-tokens.client";
import type { ApiFailure } from "@/lib/client/agent-api.client";
import type { AgentTokenRecord } from "@/types";
import { AgentAccessError, AgentSectionHeading, LoadFailure } from "./agent-access-shared";
import { ConnectedApps } from "./connected-apps";
import { AgentTokenCreateForm } from "./agent-token-create-form";
import { AgentTokenList } from "./agent-token-list";
import { AgentTokenReveal } from "./agent-token-reveal";

const HEADING_IDS = {
  create: "agent-token-create-heading",
  list: "agent-token-list-heading",
  revokeAll: "agent-revoke-all-heading",
} as const;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; failure: ApiFailure }
  | { kind: "ready"; tokens: AgentTokenRecord[] };

type FocusTarget = "create" | "list";

interface ConnectedAgentsProps {
  /** Base URL for the personal access token snippets. */
  appUrl: string;
  /** isMcpOAuthEnabled(), resolved on the server. */
  oauthEnabled: boolean;
}

/**
 * Agent access for the MCP server: with OAuth enabled, the connected apps
 * list; then personal access tokens (list, create shown once, revoke); then
 * Revoke all agent access, shown while any token or app is active. The page
 * renders the "Sign in with your browser" setup above this, as a server
 * component. Talks only to the API routes; a raw token is held in memory
 * until the user confirms they saved it.
 */
export function ConnectedAgents({ appUrl, oauthEnabled }: ConnectedAgentsProps): React.JSX.Element {
  // Bumped after revoke-all, which changes both lists, even when it failed
  // part way (it may still have revoked some tokens or apps).
  const [reloadKey, setReloadKey] = useState(0);
  const [tokensActive, setTokensActive] = useState(false);
  const [appsActive, setAppsActive] = useState(false);
  // A 401 from any agent access call; shown once for the whole section, since
  // the tokens and apps lists would otherwise each raise the same alert.
  const [sessionExpired, setSessionExpired] = useState<ApiFailure | null>(null);
  const [revokeAllBusy, setRevokeAllBusy] = useState(false);
  const [revokeAllError, setRevokeAllError] = useState<ApiFailure | null>(null);
  const [revokeAllDone, setRevokeAllDone] = useState(false);
  const [focusRevokeAll, setFocusRevokeAll] = useState(false);
  const revokeAllHeadingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);
  const wasActiveRef = useRef(false);

  const anyActive = tokensActive || (oauthEnabled && appsActive);
  const handleSessionExpired = useCallback((failure: ApiFailure) => setSessionExpired(failure), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The "revoked" confirmation stays until something becomes active again
  // (a new token or app), when it would no longer be true.
  useEffect(() => {
    if (anyActive && !wasActiveRef.current) setRevokeAllDone(false);
    wasActiveRef.current = anyActive;
  }, [anyActive]);

  useEffect(() => {
    if (!focusRevokeAll) return;
    revokeAllHeadingRef.current?.focus();
    setFocusRevokeAll(false);
  }, [focusRevokeAll]);

  async function revokeAll(): Promise<void> {
    setRevokeAllBusy(true);
    setRevokeAllError(null);
    setRevokeAllDone(false);
    const result = await revokeAllAgentTokens();
    if (!mountedRef.current) return;
    setReloadKey((key) => key + 1);
    setRevokeAllBusy(false);
    if (!result.ok) {
      if (result.reason === "unauthorized") setSessionExpired(result);
      else setRevokeAllError(result);
      return;
    }
    setRevokeAllDone(true);
    setFocusRevokeAll(true);
  }

  const showRevokeAll = anyActive || revokeAllBusy || revokeAllError !== null || revokeAllDone;

  return (
    <div className="space-y-6">
      {sessionExpired && <AgentAccessError failure={sessionExpired} />}
      {oauthEnabled && (
        <ConnectedApps
          reloadKey={reloadKey}
          locked={revokeAllBusy}
          onActiveChange={setAppsActive}
          onSessionExpired={handleSessionExpired}
        />
      )}
      <AgentTokens
        appUrl={appUrl}
        reloadKey={reloadKey}
        locked={revokeAllBusy}
        onActiveChange={setTokensActive}
        onSessionExpired={handleSessionExpired}
      />
      {showRevokeAll && (
        <RevokeAllAgentAccess
          oauthEnabled={oauthEnabled}
          canRevoke={anyActive}
          busy={revokeAllBusy}
          error={revokeAllError}
          done={revokeAllDone}
          headingRef={revokeAllHeadingRef}
          onConfirm={() => void revokeAll()}
        />
      )}
    </div>
  );
}

function RevokeAllAgentAccess({
  oauthEnabled,
  canRevoke,
  busy,
  error,
  done,
  headingRef,
  onConfirm,
}: {
  oauthEnabled: boolean;
  canRevoke: boolean;
  busy: boolean;
  error: ApiFailure | null;
  done: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
  onConfirm: () => void;
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const copy = oauthEnabled ? REVOKE_ALL_COPY.withApps : REVOKE_ALL_COPY.tokensOnly;

  return (
    <section aria-labelledby={HEADING_IDS.revokeAll} className="space-y-3">
      <div className="space-y-1">
        <AgentSectionHeading id={HEADING_IDS.revokeAll} ref={headingRef}>
          {REVOKE_ALL_COPY.heading}
        </AgentSectionHeading>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      {error && <AgentAccessError failure={error} />}
      {done && (
        <p role="status" className="text-sm">
          {REVOKE_ALL_COPY.done}
        </p>
      )}
      {canRevoke && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          {REVOKE_ALL_COPY.button}
        </Button>
      )}
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={setConfirming}
          {...copy.confirm}
          onConfirm={() => {
            setConfirming(false);
            onConfirm();
          }}
          destructive
        />
      )}
    </section>
  );
}

function AgentTokens({
  appUrl,
  reloadKey,
  locked,
  onActiveChange,
  onSessionExpired,
}: {
  appUrl: string;
  reloadKey: number;
  locked: boolean;
  onActiveChange: (active: boolean) => void;
  onSessionExpired: (failure: ApiFailure) => void;
}): React.JSX.Element | null {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiFailure | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const createHeadingRef = useRef<HTMLHeadingElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);
  const latestListRequestRef = useRef(0);

  // Reads can overlap (a create's refresh and a revoke's refresh, or a retry)
  // and resolve out of order; only the newest may touch state, so an older
  // response never overwrites a newer list or error.
  const beginListRequest = useCallback((): (() => boolean) => {
    latestListRequestRef.current += 1;
    const requestId = latestListRequestRef.current;
    return () => mountedRef.current && latestListRequestRef.current === requestId;
  }, []);

  const showActionError = useCallback(
    (failure: ApiFailure): void => {
      if (failure.reason === "unauthorized") onSessionExpired(failure);
      else setActionError(failure);
    },
    [onSessionExpired]
  );

  const loadTokens = useCallback(async (): Promise<void> => {
    const isLatest = beginListRequest();
    setLoad({ kind: "loading" });
    const result = await fetchAgentTokens();
    if (!isLatest()) return;
    if (!result.ok && result.reason === "unauthorized") onSessionExpired(result);
    setLoad(result.ok ? { kind: "ready", tokens: result.value } : { kind: "error", failure: result });
  }, [beginListRequest, onSessionExpired]);

  // The server may change more than the row acted on (create revokes an
  // expired token holding the same name), so re-read rather than patch.
  const refreshTokens = useCallback(async (): Promise<void> => {
    const isLatest = beginListRequest();
    const result = await fetchAgentTokens();
    if (!isLatest()) return;
    if (result.ok) setLoad({ kind: "ready", tokens: result.value });
    else showActionError(result);
  }, [beginListRequest, showActionError]);

  useEffect(() => {
    mountedRef.current = true;
    void loadTokens();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTokens]);

  // After revoke-all; an earlier revoke error no longer describes the list.
  useEffect(() => {
    if (reloadKey === 0) return;
    setActionError(null);
    void refreshTokens();
  }, [reloadKey, refreshTokens]);

  const anyActive = load.kind === "ready" && load.tokens.some((token) => token.status === "active");
  useEffect(() => {
    onActiveChange(anyActive);
  }, [anyActive, onActiveChange]);

  // Runs after the render that mounts the target heading, so the ref is set.
  useEffect(() => {
    if (focusTarget === null) return;
    const ref = focusTarget === "create" ? createHeadingRef : listHeadingRef;
    ref.current?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  function handleCreated(created: CreatedAgentToken): void {
    setActionError(null);
    setRevealedToken(created.token);
    void refreshTokens();
  }

  function handleRevealDone(): void {
    setRevealedToken(null);
    setFocusTarget("create");
  }

  async function revoke(id: string): Promise<void> {
    setBusy(true);
    setActionError(null);
    const result = await revokeAgentToken(id);
    if (!mountedRef.current) return;
    if (!result.ok) {
      showActionError(result);
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
    // ConnectedAgents shows the session-expired alert.
    if (load.failure.reason === "unauthorized") return null;
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
          busy={busy || locked}
          onRevoke={(id) => void revoke(id)}
        />
      </section>
    </div>
  );
}
