"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AGENT_TOKEN_STATUS_LABELS } from "@/lib/constants/agent-access-ui";
import { formatLocalDate } from "@/lib/utils/date";
import type { AgentTokenRecord } from "@/types";
import {
  AgentDetail,
  formatOptionalDate,
  LONG_TEXT_WRAP,
  scopeLabels,
} from "./agent-access-shared";

function TokenItem({
  token,
  busy,
  onRevoke,
}: {
  token: AgentTokenRecord;
  busy: boolean;
  onRevoke: (token: AgentTokenRecord) => void;
}): React.JSX.Element {
  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className={`flex-1 ${LONG_TEXT_WRAP}`}>
          <p className="font-medium">{token.name}</p>
          <p className="font-mono text-sm text-muted-foreground">{token.token_prefix}</p>
        </div>
        {token.status === "active" && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-label={`Revoke ${token.name}`}
            onClick={() => onRevoke(token)}
          >
            Revoke
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <AgentDetail term="Access">{scopeLabels(token.scopes)}</AgentDetail>
        <AgentDetail term="Status">{AGENT_TOKEN_STATUS_LABELS[token.status]}</AgentDetail>
        <AgentDetail term="Created">{formatLocalDate(token.created_at)}</AgentDetail>
        <AgentDetail term="Last used">{formatOptionalDate(token.last_used_at)}</AgentDetail>
        <AgentDetail term="Expires">{formatOptionalDate(token.expires_at)}</AgentDetail>
      </dl>
    </li>
  );
}

/**
 * The user's agent tokens, newest first. Revoking one goes through a confirm
 * step because it cuts off a running agent immediately. Revoking everything
 * lives in ConnectedAgents, since it covers connected apps too.
 */
export function AgentTokenList({
  tokens,
  busy,
  onRevoke,
}: {
  tokens: AgentTokenRecord[];
  busy: boolean;
  onRevoke: (id: string) => void;
}): React.JSX.Element {
  const [pending, setPending] = useState<AgentTokenRecord | null>(null);

  if (tokens.length === 0) {
    return <p className="text-sm text-muted-foreground">No agent tokens yet.</p>;
  }

  function confirm(): void {
    if (pending) onRevoke(pending.id);
    setPending(null);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3" aria-label="Agent tokens">
        {tokens.map((token) => (
          <TokenItem key={token.id} token={token} busy={busy} onRevoke={setPending} />
        ))}
      </ul>
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          title={`Revoke "${pending.name}"?`}
          description="Agents using this token lose access right away. This cannot be undone; you would need to create a new token."
          confirmText="Revoke"
          titleClassName={LONG_TEXT_WRAP}
          onConfirm={confirm}
          destructive
        />
      )}
    </div>
  );
}
