"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AGENT_TOKEN_LIMITS,
  AGENT_TOKEN_SCOPES,
  DEFAULT_AGENT_TOKEN_EXPIRY_DAYS,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";
import {
  AGENT_SCOPE_DETAILS,
  AGENT_TOKEN_EXPIRY_CHOICES,
  DEFAULT_AGENT_TOKEN_SCOPES,
  NEVER_EXPIRES,
  type AgentTokenExpiryChoice,
} from "@/lib/constants/agent-access-ui";
import { includesCompScope, toggleAgentScope } from "@/lib/utils/agent-token-scopes";
import { createAgentToken, type CreatedAgentToken } from "./agent-tokens-api";

const FIELD_IDS = {
  name: "agent-token-name",
  expiry: "agent-token-expiry",
  expiryHelp: "agent-token-expiry-help",
} as const;

const SELECT_CLASSES =
  "flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function parseExpiryChoice(value: string): AgentTokenExpiryChoice {
  const match = AGENT_TOKEN_EXPIRY_CHOICES.find((choice) => String(choice.value) === value);
  return match ? match.value : DEFAULT_AGENT_TOKEN_EXPIRY_DAYS;
}

function ScopeCheckbox({
  scope,
  checked,
  onChange,
}: {
  scope: AgentTokenScope;
  checked: boolean;
  onChange: (scope: AgentTokenScope, checked: boolean) => void;
}): React.JSX.Element {
  const id = `agent-scope-${scope.replace(":", "-")}`;
  const detail = AGENT_SCOPE_DETAILS[scope];
  return (
    <li className="flex items-start gap-1">
      <Checkbox
        id={id}
        checked={checked}
        aria-describedby={`${id}-description`}
        onCheckedChange={(state) => onChange(scope, state === true)}
      />
      <div className="py-3">
        <Label htmlFor={id}>{detail.label}</Label>
        <p id={`${id}-description`} className="mt-1 text-sm text-muted-foreground">
          {detail.description}
        </p>
      </div>
    </li>
  );
}

function ExpirySelect({
  value,
  neverAllowed,
  onChange,
}: {
  value: AgentTokenExpiryChoice;
  neverAllowed: boolean;
  onChange: (value: AgentTokenExpiryChoice) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor={FIELD_IDS.expiry}>Expires after</Label>
      <select
        id={FIELD_IDS.expiry}
        className={SELECT_CLASSES}
        value={String(value)}
        aria-describedby={neverAllowed ? undefined : FIELD_IDS.expiryHelp}
        onChange={(event) => onChange(parseExpiryChoice(event.target.value))}
      >
        {AGENT_TOKEN_EXPIRY_CHOICES.map((choice) => (
          <option
            key={choice.value}
            value={String(choice.value)}
            disabled={choice.value === NEVER_EXPIRES && !neverAllowed}
          >
            {choice.label}
          </option>
        ))}
      </select>
      {!neverAllowed && (
        <p id={FIELD_IDS.expiryHelp} className="text-sm text-muted-foreground">
          Tokens with comp access must expire, because comp is your most sensitive data.
        </p>
      )}
    </div>
  );
}

/**
 * Name, scopes, and expiry for a new agent token. Posts to the token API and
 * hands the created token up; API validation and limit errors show inline.
 */
export function AgentTokenCreateForm({
  onCreated,
}: {
  onCreated: (created: CreatedAgentToken) => void;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<AgentTokenScope[]>([...DEFAULT_AGENT_TOKEN_SCOPES]);
  const [expiry, setExpiry] = useState<AgentTokenExpiryChoice>(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const neverAllowed = !includesCompScope(scopes);
  const canSubmit = name.trim().length > 0 && scopes.length > 0 && !submitting;

  function handleScopeChange(scope: AgentTokenScope, checked: boolean): void {
    const next = toggleAgentScope(scopes, scope, checked);
    setScopes(next);
    if (includesCompScope(next) && expiry === NEVER_EXPIRES) {
      setExpiry(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
    }
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError("");
    const result = await createAgentToken({
      name,
      scopes,
      expires_in_days: expiry === NEVER_EXPIRES ? null : expiry,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated(result.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    void submit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create an agent token">
      <div className="space-y-2">
        <Label htmlFor={FIELD_IDS.name}>Name</Label>
        <Input
          id={FIELD_IDS.name}
          value={name}
          maxLength={AGENT_TOKEN_LIMITS.nameMax}
          placeholder="Claude Code on my laptop"
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">What this agent can do</legend>
        <ul>
          {AGENT_TOKEN_SCOPES.map((scope) => (
            <ScopeCheckbox
              key={scope}
              scope={scope}
              checked={scopes.includes(scope)}
              onChange={handleScopeChange}
            />
          ))}
        </ul>
      </fieldset>

      <ExpirySelect value={expiry} neverAllowed={neverAllowed} onChange={setExpiry} />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit}>
        {submitting ? "Creating..." : "Create token"}
      </Button>
    </form>
  );
}
