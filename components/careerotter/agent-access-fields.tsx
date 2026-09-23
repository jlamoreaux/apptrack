"use client";

/**
 * The scope checklist and expiry select shared by the token create form and
 * the OAuth consent screen, so both offer exactly the PAT rules: write
 * implies read, and "Never" is unavailable while a comp scope is checked.
 */

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
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

const EXPIRY_FIELD_IDS = {
  select: "agent-token-expiry",
  help: "agent-token-expiry-help",
} as const;

export interface AgentAccessChoice {
  scopes: AgentTokenScope[];
  expiry: AgentTokenExpiryChoice;
  neverAllowed: boolean;
  /** Applies write-implies-read and returns the new selection. */
  toggleScope: (scope: AgentTokenScope, checked: boolean) => AgentTokenScope[];
  setExpiry: (expiry: AgentTokenExpiryChoice) => void;
}

/** Selection state starting from the PAT defaults (wins read and write, 90 days). */
export function useAgentAccessChoice(): AgentAccessChoice {
  const [scopes, setScopes] = useState<AgentTokenScope[]>([...DEFAULT_AGENT_TOKEN_SCOPES]);
  const [expiry, setExpiry] = useState<AgentTokenExpiryChoice>(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);

  function toggleScope(scope: AgentTokenScope, checked: boolean): AgentTokenScope[] {
    const next = toggleAgentScope(scopes, scope, checked);
    setScopes(next);
    if (includesCompScope(next) && expiry === NEVER_EXPIRES) {
      setExpiry(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
    }
    return next;
  }

  return { scopes, expiry, neverAllowed: !includesCompScope(scopes), toggleScope, setExpiry };
}

function parseExpiryChoice(value: string): AgentTokenExpiryChoice {
  const match = AGENT_TOKEN_EXPIRY_CHOICES.find((choice) => String(choice.value) === value);
  return match ? match.value : DEFAULT_AGENT_TOKEN_EXPIRY_DAYS;
}

function ScopeCheckbox({
  scope,
  checked,
  requestedLabel,
  checkboxRef,
  onChange,
}: {
  scope: AgentTokenScope;
  checked: boolean;
  /** Shown beside the label when the app asked for this scope. */
  requestedLabel: string | null;
  checkboxRef?: React.Ref<HTMLButtonElement>;
  onChange: (scope: AgentTokenScope, checked: boolean) => void;
}): React.JSX.Element {
  const id = `agent-scope-${scope.replace(":", "-")}`;
  const descriptionId = `${id}-description`;
  const requestedId = `${id}-requested`;
  const detail = AGENT_SCOPE_DETAILS[scope];
  const describedBy = requestedLabel === null ? descriptionId : `${requestedId} ${descriptionId}`;
  return (
    <li className="flex items-start gap-1">
      <Checkbox
        id={id}
        ref={checkboxRef}
        checked={checked}
        aria-describedby={describedBy}
        onCheckedChange={(state) => onChange(scope, state === true)}
      />
      <div className="min-w-0 pb-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <Label htmlFor={id} className="flex min-h-11 items-center">
            {detail.label}
          </Label>
          {requestedLabel !== null && (
            <span id={requestedId} className="text-sm text-muted-foreground">
              {requestedLabel}
            </span>
          )}
        </div>
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {detail.description}
        </p>
      </div>
    </li>
  );
}

/**
 * One checkbox per scope. When `requested` is given, each scope the app asked
 * for that isn't checked carries its label.
 */
export function AgentScopeChecklist({
  selected,
  requested,
  firstCheckboxRef,
  onToggle,
}: {
  selected: readonly AgentTokenScope[];
  requested?: { scopes: readonly AgentTokenScope[]; label: string };
  firstCheckboxRef?: React.Ref<HTMLButtonElement>;
  onToggle: (scope: AgentTokenScope, checked: boolean) => void;
}): React.JSX.Element {
  return (
    <ul>
      {AGENT_TOKEN_SCOPES.map((scope, index) => {
        const checked = selected.includes(scope);
        const showRequested = requested !== undefined && requested.scopes.includes(scope) && !checked;
        return (
          <ScopeCheckbox
            key={scope}
            scope={scope}
            checked={checked}
            requestedLabel={showRequested ? requested.label : null}
            checkboxRef={index === 0 ? firstCheckboxRef : undefined}
            onChange={onToggle}
          />
        );
      })}
    </ul>
  );
}

/** The expiry options; "Never" is disabled, with `neverDisabledHelp` shown, when not allowed. */
export function AgentExpirySelect({
  value,
  neverAllowed,
  neverDisabledHelp,
  onChange,
}: {
  value: AgentTokenExpiryChoice;
  neverAllowed: boolean;
  neverDisabledHelp: string;
  onChange: (value: AgentTokenExpiryChoice) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor={EXPIRY_FIELD_IDS.select}>Expires after</Label>
      <NativeSelect
        id={EXPIRY_FIELD_IDS.select}
        value={String(value)}
        aria-describedby={neverAllowed ? undefined : EXPIRY_FIELD_IDS.help}
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
      </NativeSelect>
      {!neverAllowed && (
        <p id={EXPIRY_FIELD_IDS.help} className="text-sm text-muted-foreground">
          {neverDisabledHelp}
        </p>
      )}
    </div>
  );
}
