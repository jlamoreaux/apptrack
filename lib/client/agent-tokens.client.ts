/**
 * Browser-side calls to the agent token API (app/api/careerotter/agent-tokens).
 * Every call resolves to a result instead of throwing (see agent-api.client.ts),
 * and response JSON is narrowed with guards rather than trusted.
 */

import type { AgentTokenExpiryDays, AgentTokenScope } from "@/lib/constants/agent-access";
import {
  acknowledge,
  agentApiRequest,
  isAgentTokenScope,
  isAgentTokenStatus,
  isNullableString,
  isRecord,
  type ApiResult,
} from "@/lib/client/agent-api.client";
import type { AgentTokenRecord, CreatedAgentToken } from "@/types";

const AGENT_TOKENS_ENDPOINT = "/api/careerotter/agent-tokens";

const FALLBACK_MESSAGES = {
  load: "Could not load your connected agents.",
  create: "Could not create that token. Try again.",
  revoke: "Could not revoke that token. Try again.",
  revokeAll: "Could not revoke your tokens. Try again.",
} as const;

export interface CreateAgentTokenInput {
  name: string;
  scopes: AgentTokenScope[];
  /** Null means the token never expires. */
  expires_in_days: AgentTokenExpiryDays | null;
}

export type { CreatedAgentToken } from "@/types";

function isAgentTokenRecord(value: unknown): value is AgentTokenRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.token_prefix === "string" &&
    Array.isArray(value.scopes) &&
    value.scopes.every(isAgentTokenScope) &&
    typeof value.created_at === "string" &&
    isNullableString(value.last_used_at) &&
    isNullableString(value.expires_at) &&
    isNullableString(value.revoked_at) &&
    isAgentTokenStatus(value.status)
  );
}

function parseTokenList(body: unknown): AgentTokenRecord[] | null {
  if (!isRecord(body)) return null;
  const tokens: unknown = body.tokens;
  if (!Array.isArray(tokens)) return null;
  const records = tokens.filter(isAgentTokenRecord);
  return records.length === tokens.length ? records : null;
}

function parseCreated(body: unknown): CreatedAgentToken | null {
  if (!isRecord(body) || typeof body.token !== "string") return null;
  return isAgentTokenRecord(body.record) ? { token: body.token, record: body.record } : null;
}

export function fetchAgentTokens(): Promise<ApiResult<AgentTokenRecord[]>> {
  return agentApiRequest(
    AGENT_TOKENS_ENDPOINT,
    { method: "GET", cache: "no-store" },
    parseTokenList,
    FALLBACK_MESSAGES.load
  );
}

export function createAgentToken(
  input: CreateAgentTokenInput
): Promise<ApiResult<CreatedAgentToken>> {
  return agentApiRequest(
    AGENT_TOKENS_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    parseCreated,
    FALLBACK_MESSAGES.create
  );
}

export function revokeAgentToken(id: string): Promise<ApiResult<true>> {
  return agentApiRequest(
    `${AGENT_TOKENS_ENDPOINT}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    acknowledge,
    FALLBACK_MESSAGES.revoke
  );
}

export function revokeAllAgentTokens(): Promise<ApiResult<true>> {
  return agentApiRequest(
    AGENT_TOKENS_ENDPOINT,
    { method: "DELETE" },
    acknowledge,
    FALLBACK_MESSAGES.revokeAll
  );
}
