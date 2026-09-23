/**
 * The consent step's database work, through the service-role client:
 * whether the user can approve an app (the active-grant cap, and whether
 * approving replaces the app's current grant), and storing the authorization
 * code once they do. The code itself is returned to the caller only; its
 * SHA-256 digest is what's stored, and it's never logged. Never throws.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrefixedSecret } from "@/lib/auth/prefixed-secret";
import type { AgentTokenExpiryDays, AgentTokenScope } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_CREATE_CODE_OUTCOMES,
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_RPC,
  type AgentOAuthCreateCodeOutcome,
} from "@/lib/constants/agent-oauth";
import { isPlainObject } from "@/lib/careerotter/field-guards";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { AgentOAuthAuthorizeParams } from "@/types";

/** What the consent screen needs to know about the user's existing grants. */
export type ConsentGrantState =
  | {
      kind: "ok";
      /** Approving replaces this app's current access. */
      hasActiveGrant: boolean;
      /** The user can't approve another app until they remove one. */
      atCap: boolean;
    }
  | { kind: "unavailable" };

export interface AuthorizationCodeInput {
  userId: string;
  params: AgentOAuthAuthorizeParams;
  /** Already normalized: known scopes, reads implied by writes included. */
  scopes: AgentTokenScope[];
  /** Null means the grant never expires. */
  expiresInDays: AgentTokenExpiryDays | null;
}

export type AuthorizationCodeResult =
  | { kind: "ok"; code: string }
  | { kind: Exclude<AgentOAuthCreateCodeOutcome, "ok"> }
  | { kind: "unavailable" };

const GRANT_CLIENT_SELECT = "client_id";
const POSTGRES_DAYS_UNIT = "days";

function isCreateCodeOutcome(value: unknown): value is AgentOAuthCreateCodeOutcome {
  return AGENT_OAUTH_CREATE_CODE_OUTCOMES.some((outcome) => outcome === value);
}

function hasClientId(value: unknown): value is { client_id: string } {
  return isPlainObject(value) && typeof value.client_id === "string";
}

function logFailure(message: string, action: string, userId: string, error: unknown): void {
  loggerService.error(message, error, { category: LogCategory.DATABASE, action, userId });
}

// Mirrors agent_oauth_grant_cap_reached in migration 045: the cap counts the
// user's other active grants, so replacing an app's grant is always allowed.
function toGrantState(clientIds: readonly string[], clientId: string): ConsentGrantState {
  const others = clientIds.filter((id) => id !== clientId).length;
  return {
    kind: "ok",
    hasActiveGrant: clientIds.includes(clientId),
    atCap: others >= AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser,
  };
}

async function selectActiveGrantClientIds(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<{ ok: true; clientIds: string[] } | { ok: false; error: unknown }> {
  const { data, error } = await admin
    .from(AGENT_OAUTH_GRANTS_TABLE)
    .select(GRANT_CLIENT_SELECT)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
  if (error) return { ok: false, error };
  if (!Array.isArray(data)) return { ok: false, error: "Unexpected agent_oauth_grants result" };
  const rows: unknown[] = data;
  if (!rows.every(hasClientId)) return { ok: false, error: "Unexpected agent_oauth_grants row shape" };
  return { ok: true, clientIds: rows.map((row) => row.client_id) };
}

/** The user's active grants as they bear on approving `clientId` at `now`. */
export async function loadConsentGrantState(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  now: Date
): Promise<ConsentGrantState> {
  try {
    const selected = await selectActiveGrantClientIds(admin, userId, now);
    if (selected.ok) return toGrantState(selected.clientIds, clientId);
    logFailure("Failed to load OAuth grants for consent", "mcp_oauth_consent_grants_failed", userId, selected.error);
  } catch (error) {
    logFailure("Failed to load OAuth grants for consent", "mcp_oauth_consent_grants_failed", userId, error);
  }
  return { kind: "unavailable" };
}

/** The grant lifetime as a Postgres interval literal, or null for never. */
export function grantExpiresInInterval(days: AgentTokenExpiryDays | null): string | null {
  return days === null ? null : `${days} ${POSTGRES_DAYS_UNIT}`;
}

async function callCreateCode(
  admin: SupabaseClient,
  input: AuthorizationCodeInput,
  codeHash: string
): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await admin
    .rpc(AGENT_OAUTH_RPC.createCode, {
      p_user_id: input.userId,
      p_client_id: input.params.clientId,
      p_code_hash: codeHash,
      p_redirect_uri: input.params.registeredRedirectUri,
      p_code_challenge: input.params.codeChallenge,
      p_scopes: input.scopes,
      p_grant_expires_in: grantExpiresInInterval(input.expiresInDays),
      p_resource: input.params.resource,
    })
    .single();
  return { data, error };
}

/**
 * Mint a single-use `co_code_` code and store its digest with
 * create_agent_oauth_code, which takes the per-user lock and enforces the
 * grant cap. `invalid_client` means the client was deleted since validation.
 */
export async function createAuthorizationCode(
  admin: SupabaseClient,
  input: AuthorizationCodeInput
): Promise<AuthorizationCodeResult> {
  const action = "mcp_oauth_code_create_failed";
  const message = "Failed to create OAuth authorization code";
  try {
    const code = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.authorizationCode);
    const { data, error } = await callCreateCode(admin, input, code.hash);
    const outcome = isPlainObject(data) ? data.outcome : undefined;
    if (error || !isCreateCodeOutcome(outcome)) {
      logFailure(message, action, input.userId, error ?? "Unexpected create_agent_oauth_code result");
      return { kind: "unavailable" };
    }
    return outcome === "ok" ? { kind: "ok", code: code.raw } : { kind: outcome };
  } catch (error) {
    logFailure(message, action, input.userId, error);
    return { kind: "unavailable" };
  }
}
