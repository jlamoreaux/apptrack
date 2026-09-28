/**
 * Shared plumbing for the browser-side agent access clients (tokens and
 * connected apps): every call resolves to a result instead of throwing, and
 * failures carry a reason the UI can act on.
 */

import { AGENT_TOKEN_SCOPES, type AgentTokenScope } from "@/lib/constants/agent-access";
import { AGENT_API_NETWORK_ERROR, AGENT_TOKEN_STATUSES } from "@/lib/constants/agent-access-ui";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import type { AgentTokenStatus } from "@/types";

const SHARED_MESSAGES = {
  network: AGENT_API_NETWORK_ERROR,
  sessionExpired: "Your session expired.",
  rateLimited: "Too many requests.",
} as const;

const RETRY_LATER_HINT = "Try again in a minute.";
const SENTENCE_END = /[.!?]$/;

/**
 * Why a call failed, so the UI can offer the right next step: sign in again
 * (unauthorized), point at the name field (invalid, conflict), or retry.
 */
export type ApiFailureReason =
  | "unauthorized"
  | "rate_limited"
  | "conflict"
  | "invalid"
  | "network"
  | "failed";

export interface ApiFailure {
  ok: false;
  reason: ApiFailureReason;
  message: string;
}

export type ApiResult<T> = { ok: true; value: T } | ApiFailure;

const STATUS_REASONS: ReadonlyMap<number, ApiFailureReason> = new Map([
  [HTTP_STATUS.BAD_REQUEST, "invalid"],
  [HTTP_STATUS.UNAUTHORIZED, "unauthorized"],
  [HTTP_STATUS.CONFLICT, "conflict"],
  [HTTP_STATUS.TOO_MANY_REQUESTS, "rate_limited"],
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// Tokens and connected apps share scopes and statuses, so both parsers use these.
export function isAgentTokenScope(value: unknown): value is AgentTokenScope {
  return AGENT_TOKEN_SCOPES.some((scope) => scope === value);
}

export function isAgentTokenStatus(value: unknown): value is AgentTokenStatus {
  return AGENT_TOKEN_STATUSES.some((status) => status === value);
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
function serverMessage(body: unknown): string | null {
  if (isRecord(body) && typeof body.error === "string" && body.error.trim()) {
    return body.error.trim();
  }
  return null;
}

function asSentence(text: string): string {
  return SENTENCE_END.test(text) ? text : `${text}.`;
}

function failureFor(status: number, body: unknown, fallback: string): ApiFailure {
  const reason = STATUS_REASONS.get(status) ?? "failed";
  if (reason === "unauthorized") {
    return { ok: false, reason, message: SHARED_MESSAGES.sessionExpired };
  }
  if (reason === "rate_limited") {
    const message = asSentence(serverMessage(body) ?? SHARED_MESSAGES.rateLimited);
    return { ok: false, reason, message: `${message} ${RETRY_LATER_HINT}` };
  }
  return { ok: false, reason, message: serverMessage(body) ?? fallback };
}

/**
 * fetch, then narrow a 2xx body with `parse` (null means an unexpected shape,
 * reported as `fallback`). Non-2xx statuses map onto an ApiFailureReason.
 */
export async function agentApiRequest<T>(
  input: string,
  init: RequestInit,
  parse: (body: unknown) => T | null,
  fallback: string
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    return { ok: false, reason: "network", message: SHARED_MESSAGES.network };
  }
  const body = await readJson(response);
  if (!response.ok) return failureFor(response.status, body, fallback);
  const value = parse(body);
  return value === null
    ? { ok: false, reason: "failed", message: fallback }
    : { ok: true, value };
}

// Revoke responses carry nothing the UI needs; any 2xx is success.
export const acknowledge = (): true => true;
