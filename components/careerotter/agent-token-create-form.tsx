"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AGENT_TOKEN_LIMITS,
  AGENT_TOKEN_SCOPES,
  DEFAULT_AGENT_TOKEN_EXPIRY_DAYS,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";
import {
  AGENT_SCOPE_DETAILS,
  AGENT_TOKEN_EXPIRY_CHOICES,
  AGENT_TOKEN_FORM_MESSAGES,
  DEFAULT_AGENT_TOKEN_SCOPES,
  NEVER_EXPIRES,
  type AgentTokenExpiryChoice,
} from "@/lib/constants/agent-access-ui";
import {
  createAgentToken,
  type ApiFailure,
  type CreatedAgentToken,
} from "@/lib/client/agent-tokens.client";
import {
  includesCompScope,
  normalizeAgentTokenName,
  toggleAgentScope,
} from "@/lib/utils/agent-token-scopes";
import { AgentAccessError, type AgentAccessErrorDetail } from "./agent-access-shared";

const FIELD_IDS = {
  name: "agent-token-name",
  nameError: "agent-token-name-error",
  scopesError: "agent-token-scopes-error",
  expiry: "agent-token-expiry",
  expiryHelp: "agent-token-expiry-help",
  formError: "agent-token-form-error",
} as const;

function parseExpiryChoice(value: string): AgentTokenExpiryChoice {
  const match = AGENT_TOKEN_EXPIRY_CHOICES.find((choice) => String(choice.value) === value);
  return match ? match.value : DEFAULT_AGENT_TOKEN_EXPIRY_DAYS;
}

/** API rejections that are about the name (bad characters or already in use). */
function isNameFailure(failure: ApiFailure): boolean {
  return failure.reason === "invalid" || failure.reason === "conflict";
}

function nameErrorDetail(
  nameRequired: boolean,
  submitError: ApiFailure | null
): AgentAccessErrorDetail | null {
  if (nameRequired) return { message: AGENT_TOKEN_FORM_MESSAGES.nameRequired };
  return submitError && isNameFailure(submitError) ? submitError : null;
}

function ScopeCheckbox({
  scope,
  checked,
  checkboxRef,
  onChange,
}: {
  scope: AgentTokenScope;
  checked: boolean;
  checkboxRef?: React.Ref<HTMLButtonElement>;
  onChange: (scope: AgentTokenScope, checked: boolean) => void;
}): React.JSX.Element {
  const id = `agent-scope-${scope.replace(":", "-")}`;
  const detail = AGENT_SCOPE_DETAILS[scope];
  return (
    <li className="flex items-start gap-1">
      <Checkbox
        id={id}
        ref={checkboxRef}
        checked={checked}
        aria-describedby={`${id}-description`}
        onCheckedChange={(state) => onChange(scope, state === true)}
      />
      <div className="min-w-0 pb-2">
        <Label htmlFor={id} className="flex min-h-11 items-center">
          {detail.label}
        </Label>
        <p id={`${id}-description`} className="text-sm text-muted-foreground">
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
      <NativeSelect
        id={FIELD_IDS.expiry}
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
      </NativeSelect>
      {!neverAllowed && (
        <p id={FIELD_IDS.expiryHelp} className="text-sm text-muted-foreground">
          Tokens with comp access must expire, because comp is your most sensitive data.
        </p>
      )}
    </div>
  );
}

/**
 * Name, scopes, and expiry for a new agent token. The submit button stays
 * enabled so keyboard and screen reader users get an explanation instead of a
 * dead control; missing fields and API rejections show inline and take focus.
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
  const [nameRequired, setNameRequired] = useState(false);
  const [scopesRequired, setScopesRequired] = useState(false);
  const [submitError, setSubmitError] = useState<ApiFailure | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const firstScopeRef = useRef<HTMLButtonElement>(null);

  const neverAllowed = !includesCompScope(scopes);
  const nameError = nameErrorDetail(nameRequired, submitError);
  const formError = submitError && !isNameFailure(submitError) ? submitError : null;

  function handleNameChange(value: string): void {
    setName(value);
    setNameRequired(false);
    if (submitError && isNameFailure(submitError)) setSubmitError(null);
  }

  function handleScopeChange(scope: AgentTokenScope, checked: boolean): void {
    const next = toggleAgentScope(scopes, scope, checked);
    setScopes(next);
    if (next.length > 0) setScopesRequired(false);
    if (includesCompScope(next) && expiry === NEVER_EXPIRES) {
      setExpiry(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
    }
  }

  async function submit(normalizedName: string): Promise<void> {
    setSubmitting(true);
    setSubmitError(null);
    const result = await createAgentToken({
      name: normalizedName,
      scopes,
      expires_in_days: expiry === NEVER_EXPIRES ? null : expiry,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated(result.value);
      return;
    }
    setSubmitError(result);
    if (isNameFailure(result)) nameInputRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitting) return;
    const normalizedName = normalizeAgentTokenName(name);
    const missingName = normalizedName.length === 0;
    const missingScopes = scopes.length === 0;
    setName(normalizedName);
    setNameRequired(missingName);
    setScopesRequired(missingScopes);
    if (missingName) {
      nameInputRef.current?.focus();
      return;
    }
    if (missingScopes) {
      firstScopeRef.current?.focus();
      return;
    }
    void submit(normalizedName);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label="Create an agent token"
    >
      <div className="space-y-2">
        <Label htmlFor={FIELD_IDS.name}>Name</Label>
        <Input
          id={FIELD_IDS.name}
          ref={nameInputRef}
          value={name}
          required
          aria-required="true"
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? FIELD_IDS.nameError : undefined}
          maxLength={AGENT_TOKEN_LIMITS.nameMax}
          placeholder="Claude Code on my laptop"
          autoComplete="off"
          onChange={(event) => handleNameChange(event.target.value)}
        />
        {nameError && <AgentAccessError id={FIELD_IDS.nameError} failure={nameError} />}
      </div>

      <fieldset
        className="space-y-1"
        aria-describedby={scopesRequired ? FIELD_IDS.scopesError : undefined}
      >
        <legend className="text-sm font-medium">What this agent can do</legend>
        <ul>
          {AGENT_TOKEN_SCOPES.map((scope, index) => (
            <ScopeCheckbox
              key={scope}
              scope={scope}
              checked={scopes.includes(scope)}
              checkboxRef={index === 0 ? firstScopeRef : undefined}
              onChange={handleScopeChange}
            />
          ))}
        </ul>
        {scopesRequired && (
          <AgentAccessError
            id={FIELD_IDS.scopesError}
            failure={{ message: AGENT_TOKEN_FORM_MESSAGES.scopesRequired }}
          />
        )}
      </fieldset>

      <ExpirySelect value={expiry} neverAllowed={neverAllowed} onChange={setExpiry} />

      {formError && <AgentAccessError id={FIELD_IDS.formError} failure={formError} />}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create token"}
      </Button>
    </form>
  );
}
