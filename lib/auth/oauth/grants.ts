/**
 * The user's connected apps (OAuth grants) for /dashboard/data: listing them,
 * revoking one, and revoking all of them.
 *
 * Service functions take the service-role admin client, scope every call to
 * the acting user, and never throw. Revocation goes through migration 045's
 * functions, which also delete the grant's tokens, so the next MCP request
 * with any of them fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { agentTokenStatus, isAgentTokenScope } from "@/lib/auth/agent-token";
import { redirectUriDisplay } from "@/lib/auth/oauth/redirect-uri";
import {
  dbFailure,
  guarded,
  isMissingFunctionError,
  isNullableString,
  isPlainObject,
  isStringArray,
  notFound,
  ok,
  type FailureContext,
} from "@/lib/careerotter/domain-result";
import {
  AGENT_OAUTH_GRANT_HISTORY_DAYS,
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_REVOKE_OUTCOMES,
  AGENT_OAUTH_RPC,
  AGENT_OAUTH_USER_REVOKE_REASON,
  type AgentOAuthRevokeOutcome,
} from "@/lib/constants/agent-oauth";
import { MS_PER_DAY } from "@/lib/constants/dates";
import { isValidUUID } from "@/lib/utils/api-validation";
import type { AgentOAuthGrantSummary, DomainResult } from "@/types";

/** A grant row as selected here, with its client's redirect URIs embedded. */
interface GrantRow {
  id: string;
  client_name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  client: { redirect_uris: string[] } | null;
}

/** What revoking one grant did; `revoked` is false when it already was. */
export interface GrantRevocation {
  grantId: string;
  revoked: boolean;
}

const GRANT_SELECT =
  "id, client_name, scopes, created_at, last_used_at, expires_at, revoked_at, client:agent_oauth_clients(redirect_uris)";
const UNEXPECTED_ROW_SHAPE = "Unexpected agent_oauth_grants row shape";
const UNEXPECTED_REVOKE_RESULT = "Unexpected revoke_agent_oauth_grant result";
const UNEXPECTED_REVOKE_ALL_RESULT = "Unexpected revoke_all_agent_oauth_grants result";
// Several registered redirect URIs can share a display (the same port on two
// loopback hosts, e.g. localhost:33418 and 127.0.0.1:33418), so the distinct
// ones are listed once each.
const REDIRECT_DISPLAY_SEPARATOR = ", ";

const MESSAGES = {
  notFound: "Connected app not found",
  loadFailed: "Failed to load connected apps",
  revokeFailed: "Failed to revoke connected app",
  revokeAllFailed: "Failed to revoke connected apps",
} as const;

const FAILURES = {
  list: {
    action: "mcp_oauth_grants_list_failed",
    logMessage: "Failed to list OAuth grants",
    publicMessage: MESSAGES.loadFailed,
  },
  revoke: {
    action: "mcp_oauth_grant_revoke_failed",
    logMessage: "Failed to revoke OAuth grant",
    publicMessage: MESSAGES.revokeFailed,
  },
  revokeAll: {
    action: "mcp_oauth_grants_revoke_all_failed",
    logMessage: "Failed to revoke all OAuth grants",
    publicMessage: MESSAGES.revokeAllFailed,
  },
} as const satisfies Record<string, Omit<FailureContext, "userId">>;

function failureContext(userId: string, operation: keyof typeof FAILURES): FailureContext {
  return { userId, ...FAILURES[operation] };
}

// ── list ───────────────────────────────────────────────────────────────────

function isEmbeddedClient(value: unknown): value is GrantRow["client"] {
  return value === null || (isPlainObject(value) && isStringArray(value.redirect_uris));
}

function isGrantRow(value: unknown): value is GrantRow {
  if (!isPlainObject(value)) return false;
  return (
    ["id", "client_name", "created_at", "last_used_at"].every(
      (key) => typeof value[key] === "string"
    ) &&
    isStringArray(value.scopes) &&
    isNullableString(value.expires_at) &&
    isNullableString(value.revoked_at) &&
    isEmbeddedClient(value.client)
  );
}

function redirectDisplayFor(client: GrantRow["client"]): string {
  const displays = (client?.redirect_uris ?? []).map(redirectUriDisplay);
  return Array.from(new Set(displays)).join(REDIRECT_DISPLAY_SEPARATOR);
}

function toSummary(row: GrantRow, now: Date): AgentOAuthGrantSummary {
  return {
    id: row.id,
    clientName: row.client_name,
    redirectDisplay: redirectDisplayFor(row.client),
    scopes: row.scopes.filter(isAgentTokenScope),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    status: agentTokenStatus(row, now),
  };
}

function toSummaries(rows: unknown, now: Date): AgentOAuthGrantSummary[] | null {
  if (!Array.isArray(rows)) return null;
  const items: unknown[] = rows;
  const valid = items.filter(isGrantRow);
  return valid.length === items.length ? valid.map((row) => toSummary(row, now)) : null;
}

function mergeActiveFirst(
  active: AgentOAuthGrantSummary[],
  history: AgentOAuthGrantSummary[]
): AgentOAuthGrantSummary[] {
  // The two reads aren't one snapshot, so a grant revoked between them can
  // come back from both; it's listed once.
  const seen = new Set(active.map((grant) => grant.id));
  return [...active, ...history.filter((grant) => !seen.has(grant.id))];
}

/**
 * The user's active grants, then those revoked or expired within
 * AGENT_OAUTH_GRANT_HISTORY_DAYS; each group newest first. Active grants are
 * read on their own so a pile of revoked rows (reconnecting replaces a grant)
 * can't push one past the history cap. A grant that expired before the window
 * and was revoked inside it (revoke-all revokes expired grants too) ended
 * before the window, so it's left out.
 */
export async function listAgentGrants(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<DomainResult<AgentOAuthGrantSummary[]>> {
  const context = failureContext(userId, "list");
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - AGENT_OAUTH_GRANT_HISTORY_DAYS * MS_PER_DAY).toISOString();
  return guarded(context, async () => {
    const [active, history] = await Promise.all([
      admin
        .from(AGENT_OAUTH_GRANTS_TABLE)
        .select(GRANT_SELECT)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(AGENT_OAUTH_LIMITS.maxListedActiveGrants),
      admin
        .from(AGENT_OAUTH_GRANTS_TABLE)
        .select(GRANT_SELECT)
        .eq("user_id", userId)
        .or(`revoked_at.not.is.null,expires_at.lte.${nowIso}`)
        .or(`revoked_at.is.null,revoked_at.gte.${cutoff}`)
        .or(`expires_at.is.null,expires_at.gte.${cutoff}`)
        .order("created_at", { ascending: false })
        .limit(AGENT_OAUTH_LIMITS.maxListedGrants),
    ]);
    if (active.error) return dbFailure(context, active.error);
    if (history.error) return dbFailure(context, history.error);
    const activeSummaries = toSummaries(active.data, now);
    const historySummaries = toSummaries(history.data, now);
    return activeSummaries && historySummaries
      ? ok(mergeActiveFirst(activeSummaries, historySummaries))
      : dbFailure(context, UNEXPECTED_ROW_SHAPE);
  });
}

// ── revoke ─────────────────────────────────────────────────────────────────

function isRevokeOutcome(value: unknown): value is AgentOAuthRevokeOutcome {
  return AGENT_OAUTH_REVOKE_OUTCOMES.some((outcome) => outcome === value);
}

function toRevocation(
  data: unknown,
  grantId: string,
  context: FailureContext
): DomainResult<GrantRevocation> {
  const outcome = isPlainObject(data) ? data.outcome : undefined;
  if (!isRevokeOutcome(outcome)) return dbFailure(context, UNEXPECTED_REVOKE_RESULT);
  if (outcome === "not_found") return notFound(MESSAGES.notFound);
  return ok({ grantId, revoked: outcome === "revoked" });
}

/**
 * Revoke one of the user's grants (reason `user`). Idempotent. A missing,
 * foreign or non-uuid id is `not_found`, so the caller can't tell another
 * user's grant from one that doesn't exist.
 */
export async function revokeAgentGrant(
  admin: SupabaseClient,
  userId: string,
  grantId: string
): Promise<DomainResult<GrantRevocation>> {
  if (!isValidUUID(grantId)) return notFound(MESSAGES.notFound);
  const context = failureContext(userId, "revoke");
  return guarded(context, async () => {
    const { data, error } = await admin
      .rpc(AGENT_OAUTH_RPC.revokeGrant, {
        p_grant_id: grantId,
        p_user_id: userId,
        p_reason: AGENT_OAUTH_USER_REVOKE_REASON,
      })
      .single();
    if (error) return dbFailure(context, error);
    return toRevocation(data, grantId, context);
  });
}

/**
 * Revoke every unrevoked grant the user has (reason `user_all`), expired ones
 * included, and return how many of them were still unexpired: the live access
 * this cut off, which is what the response and analytics report. Runs
 * whether or not OAuth is enabled, so turning the flag off and on can't revive
 * a grant the user meant to revoke. Before migration 045 has run the function
 * doesn't exist, and there can be no grants, so that counts as 0.
 */
export async function revokeAllAgentGrants(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<number>> {
  const context = failureContext(userId, "revokeAll");
  return guarded(context, async () => {
    const { data, error } = await admin.rpc(AGENT_OAUTH_RPC.revokeAllGrants, {
      p_user_id: userId,
    });
    if (isMissingFunctionError(error)) return ok(0);
    if (error) return dbFailure(context, error);
    return Number.isInteger(data) && typeof data === "number"
      ? ok(data)
      : dbFailure(context, UNEXPECTED_REVOKE_ALL_RESULT);
  });
}
