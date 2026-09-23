"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_TOKEN_LIMITS, type AgentTokenScope } from "@/lib/constants/agent-access";
import { AGENT_TOKEN_FORM_MESSAGES, NEVER_EXPIRES } from "@/lib/constants/agent-access-ui";
import { createAgentToken, type CreatedAgentToken } from "@/lib/client/agent-tokens.client";
import type { ApiFailure } from "@/lib/client/agent-api.client";
import { normalizeAgentTokenName } from "@/lib/utils/agent-token-scopes";
import {
  AgentExpirySelect,
  AgentScopeChecklist,
  useAgentAccessChoice,
} from "./agent-access-fields";
import { AgentAccessError, type AgentAccessErrorDetail } from "./agent-access-shared";

const FIELD_IDS = {
  name: "agent-token-name",
  nameError: "agent-token-name-error",
  scopesError: "agent-token-scopes-error",
  formError: "agent-token-form-error",
} as const;

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
  const { scopes, expiry, neverAllowed, toggleScope, setExpiry } = useAgentAccessChoice();
  const [submitting, setSubmitting] = useState(false);
  const [nameRequired, setNameRequired] = useState(false);
  const [scopesRequired, setScopesRequired] = useState(false);
  const [submitError, setSubmitError] = useState<ApiFailure | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const firstScopeRef = useRef<HTMLButtonElement>(null);

  const nameError = nameErrorDetail(nameRequired, submitError);
  const formError = submitError && !isNameFailure(submitError) ? submitError : null;

  function handleNameChange(value: string): void {
    setName(value);
    setNameRequired(false);
    if (submitError && isNameFailure(submitError)) setSubmitError(null);
  }

  function handleScopeChange(scope: AgentTokenScope, checked: boolean): void {
    const next = toggleScope(scope, checked);
    if (next.length > 0) setScopesRequired(false);
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
        <AgentScopeChecklist
          selected={scopes}
          firstCheckboxRef={firstScopeRef}
          onToggle={handleScopeChange}
        />
        {scopesRequired && (
          <AgentAccessError
            id={FIELD_IDS.scopesError}
            failure={{ message: AGENT_TOKEN_FORM_MESSAGES.scopesRequired }}
          />
        )}
      </fieldset>

      <AgentExpirySelect
        value={expiry}
        neverAllowed={neverAllowed}
        onChange={setExpiry}
      />

      {formError && <AgentAccessError id={FIELD_IDS.formError} failure={formError} />}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create token"}
      </Button>
    </form>
  );
}
