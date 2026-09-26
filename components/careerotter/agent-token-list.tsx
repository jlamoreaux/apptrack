"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AGENT_SCOPE_DETAILS,
  AGENT_TOKEN_NEVER_LABEL,
  AGENT_TOKEN_STATUS_LABELS,
} from "@/lib/constants/agent-access-ui";
import { formatLocalDate } from "@/lib/utils/date";
import type { AgentTokenRecord } from "@/types";

type PendingRevoke = { kind: "one"; token: AgentTokenRecord } | { kind: "all" } | null;

// Token names are user-supplied and may be one unbroken string. overflow-wrap
// "anywhere" also lowers the min-content width, which grid and flex parents
// size from, so a long name wraps instead of forcing horizontal scroll.
const LONG_TEXT_WRAP = "min-w-0 break-words [overflow-wrap:anywhere]";

function formatOptionalDate(value: string | null): string {
  return value === null ? AGENT_TOKEN_NEVER_LABEL : formatLocalDate(value);
}

function scopeLabels(token: AgentTokenRecord): string {
  return token.scopes.map((scope) => AGENT_SCOPE_DETAILS[scope].label).join(", ");
}

function confirmCopy(pending: Exclude<PendingRevoke, null>): {
  title: string;
  description: string;
  confirmText: string;
} {
  if (pending.kind === "all") {
    return {
      title: "Revoke all agent tokens?",
      description:
        "Every connected agent loses access right away. This cannot be undone; you would need to create new tokens.",
      confirmText: "Revoke all",
    };
  }
  return {
    title: `Revoke "${pending.token.name}"?`,
    description:
      "Agents using this token lose access right away. This cannot be undone; you would need to create a new token.",
    confirmText: "Revoke",
  };
}

function TokenDetail({ term, children }: { term: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

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
        <TokenDetail term="Access">{scopeLabels(token)}</TokenDetail>
        <TokenDetail term="Status">{AGENT_TOKEN_STATUS_LABELS[token.status]}</TokenDetail>
        <TokenDetail term="Created">{formatLocalDate(token.created_at)}</TokenDetail>
        <TokenDetail term="Last used">{formatOptionalDate(token.last_used_at)}</TokenDetail>
        <TokenDetail term="Expires">{formatOptionalDate(token.expires_at)}</TokenDetail>
      </dl>
    </li>
  );
}

/**
 * The user's agent tokens, newest first. Revoking one or all goes through a
 * confirm step because it cuts off a running agent immediately.
 */
export function AgentTokenList({
  tokens,
  busy,
  onRevoke,
  onRevokeAll,
}: {
  tokens: AgentTokenRecord[];
  busy: boolean;
  onRevoke: (id: string) => void;
  onRevokeAll: () => void;
}): React.JSX.Element {
  const [pending, setPending] = useState<PendingRevoke>(null);

  if (tokens.length === 0) {
    return <p className="text-sm text-muted-foreground">No agents connected yet.</p>;
  }

  const anyActive = tokens.some((token) => token.status === "active");

  function confirm(): void {
    if (pending?.kind === "all") onRevokeAll();
    else if (pending?.kind === "one") onRevoke(pending.token.id);
    setPending(null);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3" aria-label="Agent tokens">
        {tokens.map((token) => (
          <TokenItem
            key={token.id}
            token={token}
            busy={busy}
            onRevoke={(target) => setPending({ kind: "one", token: target })}
          />
        ))}
      </ul>
      {anyActive && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setPending({ kind: "all" })}
        >
          Revoke all
        </Button>
      )}
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          {...confirmCopy(pending)}
          titleClassName={LONG_TEXT_WRAP}
          onConfirm={confirm}
          destructive
        />
      )}
    </div>
  );
}
