/**
 * Browser-side call to POST /api/oauth/authorize, the consent decision.
 * Resolves to where the browser should go next, or a message to show; never
 * throws, and the response JSON is narrowed rather than trusted.
 */

import { AGENT_OAUTH_PATHS } from "@/lib/constants/agent-oauth";
import { OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";
import type { AgentOAuthConsentRequestBody } from "@/types";

export type ConsentDecisionResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; message: string };

const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  conflict: 409,
  serverErrorMin: 500,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return null;
  }
}

/** The message for a failed response; a 400 shows the server's reason when it gave one. */
function failureMessage(status: number, body: unknown): string {
  if (status === HTTP_STATUS.badRequest && isRecord(body) && typeof body.error === "string") {
    return body.error;
  }
  if (status === HTTP_STATUS.unauthorized) return OAUTH_CONSENT_MESSAGES.unauthorized;
  if (status === HTTP_STATUS.conflict) return OAUTH_CONSENT_MESSAGES.atCap;
  if (status >= HTTP_STATUS.serverErrorMin) return OAUTH_CONSENT_MESSAGES.retry;
  return OAUTH_CONSENT_MESSAGES.invalid;
}

export async function submitConsentDecision(
  body: AgentOAuthConsentRequestBody
): Promise<ConsentDecisionResult> {
  let response: Response;
  try {
    response = await fetch(AGENT_OAUTH_PATHS.consentDecision, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: OAUTH_CONSENT_MESSAGES.network };
  }
  const json = await readJson(response);
  if (response.ok && isRecord(json) && typeof json.redirectUrl === "string") {
    return { ok: true, redirectUrl: json.redirectUrl };
  }
  return { ok: false, message: failureMessage(response.status, json) };
}
