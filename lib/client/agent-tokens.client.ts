/**
 * Browser-side calls to the agent token API (app/api/careerotter/agent-tokens).
 * Every call resolves to a result instead of throwing (see agent-api.client.ts),
 * and response JSON is narrowed with guards rather than trusted.
 */

import {
  AGENT_TOKEN_SCOPES,
  type AgentTokenExpiryDays,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";
import { AGENT_TOKEN_STATUSES } from "@/lib/constants/agent-access-ui";
import {
  acknowledge,
  agentApiRequest,
  isNullableString,
  isRecord,
  type ApiResult,
} from "@/lib/client/agent-api.client";
import type { AgentTokenRecord, AgentTokenStatus, CreatedAgentToken } from "@/types";

export type { ApiFailure, ApiFailureReason, ApiResult } from "@/lib/client/agent-api.client";

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

export function isAgentTokenScope(value: unknown): value is AgentTokenScope {
  return AGENT_TOKEN_SCOPES.some((scope) => scope === value);
}

export function isAgentTokenStatus(value: unknown): value is AgentTokenStatus {
  return AGENT_TOKEN_STATUSES.some((status) => status === value);
}

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
