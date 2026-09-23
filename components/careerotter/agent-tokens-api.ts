/**
 * Browser-side calls to the agent token API (app/api/careerotter/agent-tokens).
 * Every call resolves to a result instead of throwing, and response JSON is
 * narrowed with guards rather than trusted.
 */

import {
  AGENT_TOKEN_SCOPES,
  type AgentTokenExpiryDays,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";
import type { AgentTokenRecord, AgentTokenStatus } from "@/types";

const AGENT_TOKENS_ENDPOINT = "/api/careerotter/agent-tokens";

const FALLBACK_MESSAGES = {
  load: "Could not load your connected agents. Refresh to try again.",
  create: "Could not create that token. Try again.",
  revoke: "Could not revoke that token. Try again.",
  revokeAll: "Could not revoke your tokens. Try again.",
  network: "Could not reach CareerOtter. Check your connection and try again.",
} as const;

const AGENT_TOKEN_STATUSES: readonly AgentTokenStatus[] = ["active", "expired", "revoked"];

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface CreateAgentTokenInput {
  name: string;
  scopes: AgentTokenScope[];
  /** Null means the token never expires. */
  expires_in_days: AgentTokenExpiryDays | null;
}

export interface CreatedAgentToken {
  token: string;
  record: AgentTokenRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isAgentTokenScope(value: unknown): value is AgentTokenScope {
  return AGENT_TOKEN_SCOPES.some((scope) => scope === value);
}

function isAgentTokenStatus(value: unknown): value is AgentTokenStatus {
  return AGENT_TOKEN_STATUSES.some((status) => status === value);
}

export function isAgentTokenRecord(value: unknown): value is AgentTokenRecord {
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

async function readJson(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return null;
  }
}

/** The API's `{ error }` message when present, so limits and conflicts read as the server phrased them. */
function errorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }
  return fallback;
}

async function request<T>(
  input: string,
  init: RequestInit,
  parse: (body: unknown) => T | null,
  fallback: string
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    return { ok: false, message: FALLBACK_MESSAGES.network };
  }
  const body = await readJson(response);
  if (!response.ok) return { ok: false, message: errorMessage(body, fallback) };
  const value = parse(body);
  return value === null ? { ok: false, message: fallback } : { ok: true, value };
}

// Revoke responses carry nothing the UI needs; any 2xx is success.
const acknowledge = (): true => true;

export function fetchAgentTokens(): Promise<ApiResult<AgentTokenRecord[]>> {
  return request(
    AGENT_TOKENS_ENDPOINT,
    { method: "GET", cache: "no-store" },
    parseTokenList,
    FALLBACK_MESSAGES.load
  );
}

export function createAgentToken(
  input: CreateAgentTokenInput
): Promise<ApiResult<CreatedAgentToken>> {
  return request(
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
  return request(
    `${AGENT_TOKENS_ENDPOINT}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    acknowledge,
    FALLBACK_MESSAGES.revoke
  );
}

export function revokeAllAgentTokens(): Promise<ApiResult<true>> {
  return request(
    AGENT_TOKENS_ENDPOINT,
    { method: "DELETE" },
    acknowledge,
    FALLBACK_MESSAGES.revokeAll
  );
}
