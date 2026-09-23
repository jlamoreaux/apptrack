/**
 * Client-side scope selection for the token create form. Mirrors the API's
 * "write implies read" normalization so the form never offers a combination the
 * server would silently change.
 */

import {
  AGENT_COMP_SCOPES,
  AGENT_TOKEN_SCOPES,
  SCOPE_IMPLIES,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";

function inCanonicalOrder(scopes: ReadonlySet<AgentTokenScope>): AgentTokenScope[] {
  return AGENT_TOKEN_SCOPES.filter((scope) => scopes.has(scope));
}

/** Scopes whose grant implies `scope`, e.g. wins:write for wins:read. */
function scopesImplying(scope: AgentTokenScope): AgentTokenScope[] {
  return AGENT_TOKEN_SCOPES.filter((candidate) =>
    (SCOPE_IMPLIES[candidate] ?? []).includes(scope)
  );
}

/**
 * Checking a scope also checks what it implies; unchecking a scope also
 * unchecks anything that implies it.
 */
export function toggleAgentScope(
  selected: readonly AgentTokenScope[],
  scope: AgentTokenScope,
  checked: boolean
): AgentTokenScope[] {
  const next = new Set(selected);
  if (checked) {
    next.add(scope);
    for (const implied of SCOPE_IMPLIES[scope] ?? []) next.add(implied);
  } else {
    next.delete(scope);
    for (const dependent of scopesImplying(scope)) next.delete(dependent);
  }
  return inCanonicalOrder(next);
}

export function includesCompScope(scopes: readonly AgentTokenScope[]): boolean {
  return scopes.some((scope) => AGENT_COMP_SCOPES.includes(scope));
}
