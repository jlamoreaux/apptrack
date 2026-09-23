"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fetchAgentGrants, revokeAgentGrant } from "@/lib/client/agent-grants.client";
import type { ApiFailure } from "@/lib/client/agent-api.client";
import {
  AGENT_TOKEN_STATUS_LABELS,
  CONNECTED_APP_COPY,
} from "@/lib/constants/agent-access-ui";
import { formatLocalDate } from "@/lib/utils/date";
import type { AgentOAuthGrantSummary } from "@/types";
import {
  AgentAccessError,
  AgentDetail,
  AgentSectionHeading,
  formatOptionalDate,
  LONG_TEXT_WRAP,
  scopeLabels,
} from "./agent-access-shared";

const CONNECTED_APPS_HEADING_ID = "connected-apps-heading";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; failure: ApiFailure }
  | { kind: "ready"; grants: AgentOAuthGrantSummary[] };

function GrantItem({
  grant,
  busy,
  onRevoke,
}: {
  grant: AgentOAuthGrantSummary;
  busy: boolean;
  onRevoke: (grant: AgentOAuthGrantSummary) => void;
}): React.JSX.Element {
  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className={`flex-1 ${LONG_TEXT_WRAP}`}>
          {/* bdi, as on the consent screen, so a right-to-left name can't reorder the line. */}
          <p className="font-medium">
            <bdi>{grant.clientName}</bdi>
          </p>
          {grant.redirectDisplay !== "" && (
            <p className="text-sm text-muted-foreground">
              {CONNECTED_APP_COPY.sendsYouBackTo}{" "}
              <span className="font-medium text-foreground">{grant.redirectDisplay}</span>
            </p>
          )}
        </div>
        {grant.status === "active" && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-label={`Revoke ${grant.clientName}`}
            onClick={() => onRevoke(grant)}
          >
            Revoke
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <AgentDetail term="Access">{scopeLabels(grant.scopes)}</AgentDetail>
        <AgentDetail term="Status">{AGENT_TOKEN_STATUS_LABELS[grant.status]}</AgentDetail>
        <AgentDetail term={CONNECTED_APP_COPY.connected}>
          {formatLocalDate(grant.createdAt)}
        </AgentDetail>
        <AgentDetail term="Last used">{formatLocalDate(grant.lastUsedAt)}</AgentDetail>
        <AgentDetail term="Expires">{formatOptionalDate(grant.expiresAt)}</AgentDetail>
      </dl>
    </li>
  );
}

/**
 * Apps connected by signing in with the browser (OAuth grants): active ones
 * plus those revoked or expired in the last 30 days. Revoking goes through a
 * confirm step because it cuts off a running app immediately. `reloadKey`
 * changes when something else (revoke-all) may have changed the list.
 */
export function ConnectedApps({ reloadKey }: { reloadKey: number }): React.JSX.Element {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [pending, setPending] = useState<AgentOAuthGrantSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiFailure | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);
  const latestRequestRef = useRef(0);

  // Loads can overlap (a revoke's refresh and a revoke-all reload) and resolve
  // out of order; only the newest may touch state.
  const loadGrants = useCallback(async (): Promise<boolean> => {
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;
    const result = await fetchAgentGrants();
    if (!mountedRef.current || latestRequestRef.current !== requestId) return false;
    setLoad(result.ok ? { kind: "ready", grants: result.value } : { kind: "error", failure: result });
    return result.ok;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants, reloadKey]);

  async function revoke(grant: AgentOAuthGrantSummary): Promise<void> {
    setBusy(true);
    setActionError(null);
    const result = await revokeAgentGrant(grant.id);
    if (!mountedRef.current) return;
    if (!result.ok) {
      setActionError(result);
      setBusy(false);
      return;
    }
    await loadGrants();
    if (!mountedRef.current) return;
    setBusy(false);
    headingRef.current?.focus();
  }

  function confirm(): void {
    if (pending) void revoke(pending);
    setPending(null);
  }

  return (
    <section aria-labelledby={CONNECTED_APPS_HEADING_ID} className="space-y-3">
      <AgentSectionHeading id={CONNECTED_APPS_HEADING_ID} ref={headingRef}>
        Connected apps
      </AgentSectionHeading>
      {actionError && <AgentAccessError failure={actionError} />}
      {load.kind === "loading" && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Loading connected apps...
        </p>
      )}
      {load.kind === "error" && (
        <div className="space-y-3">
          <AgentAccessError failure={load.failure} />
          {load.failure.reason !== "unauthorized" && (
            <Button type="button" variant="outline" onClick={() => void loadGrants()}>
              Try again
            </Button>
          )}
        </div>
      )}
      {load.kind === "ready" && load.grants.length === 0 && (
        <p className="text-sm text-muted-foreground">{CONNECTED_APP_COPY.empty}</p>
      )}
      {load.kind === "ready" && load.grants.length > 0 && (
        <ul className="space-y-3" aria-label="Connected apps">
          {load.grants.map((grant) => (
            <GrantItem key={grant.id} grant={grant} busy={busy} onRevoke={setPending} />
          ))}
        </ul>
      )}
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          title={`Revoke "${pending.clientName}"?`}
          description="This app loses access right away. To use it again, reconnect it from the app and sign in."
          confirmText="Revoke"
          titleClassName={LONG_TEXT_WRAP}
          onConfirm={confirm}
          destructive
        />
      )}
    </section>
  );
}
