"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  AgentExpirySelect,
  AgentScopeChecklist,
  useAgentAccessChoice,
} from "@/components/careerotter/agent-access-fields";
import type { AgentTokenScope } from "@/lib/constants/agent-access";
import { NEVER_EXPIRES } from "@/lib/constants/agent-access-ui";
import { OAUTH_CONSENT_COPY, OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";
import { submitConsentDecision } from "@/lib/client/oauth-consent.client";
import { navigateTo } from "@/lib/utils/browser-navigation";
import type { AgentOAuthConsentDecision, AgentOAuthConsentRequestBody } from "@/types";

const FIELD_IDS = {
  scopesError: "oauth-consent-scopes-error",
  formError: "oauth-consent-form-error",
} as const;

/**
 * Scopes, expiry and the Approve and Deny buttons. The server revalidates the
 * whole request and applies the same scope and expiry rules; on success the
 * browser goes wherever it answers (the app, with a code or an error). When
 * `canApprove` is false (the user is at the connected-app cap), only Deny is
 * offered.
 */
export function ConsentForm({
  requestParams,
  requestedScopes,
  canApprove,
}: {
  requestParams: Record<string, string>;
  requestedScopes: readonly AgentTokenScope[];
  canApprove: boolean;
}): React.JSX.Element {
  const { scopes, expiry, neverAllowed, toggleScope, setExpiry } = useAgentAccessChoice();
  const [pending, setPending] = useState<AgentOAuthConsentDecision | null>(null);
  const [scopesRequired, setScopesRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstScopeRef = useRef<HTMLButtonElement>(null);

  function handleScopeChange(scope: AgentTokenScope, checked: boolean): void {
    if (toggleScope(scope, checked).length > 0) setScopesRequired(false);
  }

  function requestBody(decision: AgentOAuthConsentDecision): AgentOAuthConsentRequestBody {
    if (decision === "deny") return { params: requestParams, decision };
    return {
      params: requestParams,
      decision,
      scopes,
      expiresInDays: expiry === NEVER_EXPIRES ? null : expiry,
    };
  }

  async function decide(decision: AgentOAuthConsentDecision): Promise<void> {
    setPending(decision);
    setError(null);
    const result = await submitConsentDecision(requestBody(decision));
    if (result.ok) {
      // Stay pending while the browser leaves, so the choice can't be sent twice.
      navigateTo(result.redirectUrl);
      return;
    }
    setPending(null);
    setError(result.message);
  }

  function handleApprove(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending !== null) return;
    if (scopes.length === 0) {
      setScopesRequired(true);
      firstScopeRef.current?.focus();
      return;
    }
    void decide("approve");
  }

  function handleDeny(): void {
    if (pending !== null) return;
    void decide("deny");
  }

  return (
    <form noValidate onSubmit={handleApprove} className="space-y-4" aria-label={OAUTH_CONSENT_COPY.formLabel}>
      {canApprove && (
        <>
          <fieldset
            className="space-y-1"
            aria-describedby={scopesRequired ? FIELD_IDS.scopesError : undefined}
          >
            <legend className="text-sm font-medium">{OAUTH_CONSENT_COPY.scopesLegend}</legend>
            <AgentScopeChecklist
              selected={scopes}
              requested={{ scopes: requestedScopes, label: OAUTH_CONSENT_COPY.requestedByApp }}
              firstCheckboxRef={firstScopeRef}
              onToggle={handleScopeChange}
            />
            {scopesRequired && (
              <p id={FIELD_IDS.scopesError} role="alert" className="text-sm text-destructive">
                {OAUTH_CONSENT_MESSAGES.scopesRequired}
              </p>
            )}
          </fieldset>
          <AgentExpirySelect
            value={expiry}
            neverAllowed={neverAllowed}
            neverDisabledHelp={OAUTH_CONSENT_COPY.expiryHelp}
            onChange={setExpiry}
          />
        </>
      )}

      {error && (
        <p id={FIELD_IDS.formError} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={pending !== null} onClick={handleDeny}>
          {pending === "deny" ? OAUTH_CONSENT_COPY.submitting : OAUTH_CONSENT_COPY.deny}
        </Button>
        {canApprove && (
          <Button type="submit" disabled={pending !== null}>
            {pending === "approve" ? OAUTH_CONSENT_COPY.submitting : OAUTH_CONSENT_COPY.approve}
          </Button>
        )}
      </div>
    </form>
  );
}
