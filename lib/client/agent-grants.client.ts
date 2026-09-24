/**
 * Browser-side calls to the connected apps API
 * (app/api/careerotter/agent-grants). Every call resolves to a result instead
 * of throwing (see agent-api.client.ts), and response JSON is narrowed with
 * guards rather than trusted.
 */

import {
  acknowledge,
  agentApiRequest,
  isAgentTokenScope,
  isAgentTokenStatus,
  isNullableString,
  isRecord,
  type ApiResult,
} from "@/lib/client/agent-api.client";
import type { AgentOAuthGrantSummary } from "@/types";

const AGENT_GRANTS_ENDPOINT = "/api/careerotter/agent-grants";

const FALLBACK_MESSAGES = {
  load: "Could not load your connected apps.",
  revoke: "Could not revoke that app. Try again.",
} as const;

function isGrantSummary(value: unknown): value is AgentOAuthGrantSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.clientName === "string" &&
    typeof value.redirectDisplay === "string" &&
    Array.isArray(value.scopes) &&
    value.scopes.every(isAgentTokenScope) &&
    typeof value.createdAt === "string" &&
    typeof value.lastUsedAt === "string" &&
    isNullableString(value.expiresAt) &&
    isAgentTokenStatus(value.status)
  );
}

// While OAuth is disabled the API answers { enabled: false, grants: [] },
// which reads as an empty list.
function parseGrantList(body: unknown): AgentOAuthGrantSummary[] | null {
  if (!isRecord(body)) return null;
  const grants: unknown = body.grants;
  if (!Array.isArray(grants)) return null;
  const summaries = grants.filter(isGrantSummary);
  return summaries.length === grants.length ? summaries : null;
}

export function fetchAgentGrants(): Promise<ApiResult<AgentOAuthGrantSummary[]>> {
  return agentApiRequest(
    AGENT_GRANTS_ENDPOINT,
    { method: "GET", cache: "no-store" },
    parseGrantList,
    FALLBACK_MESSAGES.load
  );
}

export function revokeAgentGrant(id: string): Promise<ApiResult<true>> {
  return agentApiRequest(
    `${AGENT_GRANTS_ENDPOINT}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    acknowledge,
    FALLBACK_MESSAGES.revoke
  );
}
