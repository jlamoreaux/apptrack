/**
 * Browser-side call to POST /api/oauth/authorize, the consent decision.
 * Resolves to where the browser should go next, or why it can't and a
 * message to show; never throws, and the response JSON is narrowed rather
 * than trusted.
 */

import { isPlainObject } from "@/lib/careerotter/field-guards";
import { AGENT_OAUTH_PATHS } from "@/lib/constants/agent-oauth";
import { OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import type { AgentOAuthAccountChangedBody, AgentOAuthConsentRequestBody } from "@/types";

/**
 * Why a decision failed: `unauthorized` means the session ended (sign in
 * again), `account_changed` that another account is now signed in (reload).
 */
export type ConsentDecisionFailureReason = "unauthorized" | "account_changed" | "failed";

export type ConsentDecisionResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; reason: ConsentDecisionFailureReason; message: string };

const ACCOUNT_CHANGED_ERROR = "account_changed" satisfies AgentOAuthAccountChangedBody["error"];

async function readJson(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return null;
  }
}

function failed(message: string): ConsentDecisionResult {
  return { ok: false, reason: "failed", message };
}

/** The result for a failed response; a 400 shows the server's reason when it gave one. */
function failureFor(status: number, body: unknown): ConsentDecisionResult {
  const serverError = isPlainObject(body) && typeof body.error === "string" ? body.error : null;
  if (status === HTTP_STATUS.BAD_REQUEST && serverError !== null) return failed(serverError);
  if (status === HTTP_STATUS.UNAUTHORIZED) {
    return { ok: false, reason: "unauthorized", message: OAUTH_CONSENT_MESSAGES.unauthorized };
  }
  if (status === HTTP_STATUS.CONFLICT && serverError === ACCOUNT_CHANGED_ERROR) {
    return { ok: false, reason: "account_changed", message: OAUTH_CONSENT_MESSAGES.accountChanged };
  }
  if (status === HTTP_STATUS.CONFLICT) return failed(OAUTH_CONSENT_MESSAGES.atCap);
  if (status >= HTTP_STATUS.SERVER_ERROR_MIN) return failed(OAUTH_CONSENT_MESSAGES.retry);
  return failed(OAUTH_CONSENT_MESSAGES.invalid);
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
    return failed(OAUTH_CONSENT_MESSAGES.network);
  }
  const json = await readJson(response);
  if (response.ok && isPlainObject(json) && typeof json.redirectUrl === "string") {
    return { ok: true, redirectUrl: json.redirectUrl };
  }
  return failureFor(response.status, json);
}
