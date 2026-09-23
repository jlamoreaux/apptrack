/**
 * OAuth tokens: the authorization-code and refresh grants at the token
 * endpoint, RFC 7009 revocation, and the access-token lookup the MCP route
 * uses.
 *
 * Everything that can be refused without side effects (the code's client,
 * redirect_uri, PKCE and resource; the refresh token's client, resource and
 * scope) is checked in TypeScript first. Only then does the database function
 * run, which handles expiry, reuse and the grant cap atomically; reuse revokes
 * the grant, so it must never be reachable by someone who only intercepted a
 * code or token. Access and refresh tokens are `co_oat_` and `co_ort_`
 * prefixed secrets stored as SHA-256 digests. Rows go through the
 * service-role client. Nothing here throws or logs token material.
 *
 * The side-effect-free lookups are aborted after AGENT_OAUTH_DEADLINES_MS.dbRead
 * (then `unavailable`, a 503). The database functions are never aborted from
 * here, since a cancelled call could leave the client unsure whether a code or
 * refresh token was consumed; their lock waits are bounded by lock_timeout in
 * migration 045 instead, and a timeout comes back as an error (`unavailable`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAgentTokenScope } from "@/lib/auth/agent-token";
import { requestedKnownScopes } from "@/lib/auth/oauth/authorize-params";
import { verifyPkceS256 } from "@/lib/auth/oauth/pkce";
import { matchRegisteredRedirectUri } from "@/lib/auth/oauth/redirect-uri";
import { normalizeResource } from "@/lib/auth/oauth/resource";
import {
  generatePrefixedSecret,
  hashSecret,
  hasValidPrefixedSecretFormat,
} from "@/lib/auth/prefixed-secret";
import { isNullableString, isPlainObject, isStringArray } from "@/lib/careerotter/field-guards";
import { LAST_USED_TOUCH_INTERVAL_MS } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_CODES_TABLE,
  AGENT_OAUTH_DEADLINES_MS,
  AGENT_OAUTH_EXCHANGE_OUTCOMES,
  AGENT_OAUTH_GRANT_CAP_DESCRIPTION,
  AGENT_OAUTH_GRANT_TYPE,
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_PREFIXES,
  AGENT_OAUTH_REVOKE_OUTCOMES,
  AGENT_OAUTH_ROTATE_OUTCOMES,
  AGENT_OAUTH_RPC,
  AGENT_OAUTH_TOKEN_KIND,
  AGENT_OAUTH_TOKENS_TABLE,
  type AgentOAuthExchangeOutcome,
  type AgentOAuthRevokeOutcome,
  type AgentOAuthRotateOutcome,
} from "@/lib/constants/agent-oauth";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { isExpiredAt } from "@/lib/utils/date";
import { withAbortableTimeout } from "@/lib/utils/with-timeout";
import type {
  AgentOAuthAccessTokenLookup,
  AgentOAuthClientRecord,
  AgentOAuthCodeExchangeTokens,
  AgentOAuthIssuedTokens,
  AgentOAuthTokenErrorCode,
  AgentOAuthTokenGrantResult,
  AgentOAuthTokenRejectionReason,
  AgentOAuthTokenRevocation,
  AgentTokenScope,
} from "@/types";

// ── types ──────────────────────────────────────────────────────────────────

/** The authorization_code grant's parameters, already required to be present. */
export interface CodeExchangeRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  /** Null when the request had no resource parameter. */
  resource: string | null;
}

/** The refresh_token grant's parameters. */
export interface RefreshRequest {
  refreshToken: string;
  resource: string | null;
  scope: string | null;
}

type Rejected = Extract<AgentOAuthTokenGrantResult<AgentOAuthIssuedTokens>, { kind: "rejected" }>;

// ── constants ──────────────────────────────────────────────────────────────

const CODE_SELECT = "client_id, redirect_uri, code_challenge, resource";
const REFRESH_TOKEN_SELECT = `kind, grant:${AGENT_OAUTH_GRANTS_TABLE}(client_id, resource, scopes)`;
const ACCESS_TOKEN_SELECT = `expires_at, grant:${AGENT_OAUTH_GRANTS_TABLE}(id, user_id, scopes, last_used_at, expires_at, revoked_at)`;

const DESCRIPTIONS = {
  code: "The authorization code is invalid, expired, or doesn't match this request",
  refresh: "The refresh token is invalid or expired",
  resource: "resource doesn't match the resource this authorization is for",
  scope: "scope includes scopes this authorization wasn't granted",
  refreshNotRegistered: "This client didn't register the refresh_token grant",
} as const;

const UNAVAILABLE = { ok: false, kind: "unavailable" } as const;

// ── shared ─────────────────────────────────────────────────────────────────

function reject(
  error: AgentOAuthTokenErrorCode,
  description: string,
  reason: AgentOAuthTokenRejectionReason
): Rejected {
  return { ok: false, kind: "rejected", error, description, reason };
}

function rejectCode(reason: AgentOAuthTokenRejectionReason): Rejected {
  return reject("invalid_grant", DESCRIPTIONS.code, reason);
}

function rejectRefresh(reason: AgentOAuthTokenRejectionReason): Rejected {
  return reject("invalid_grant", DESCRIPTIONS.refresh, reason);
}

function logDatabaseFailure(message: string, action: string, error: unknown): void {
  loggerService.error(message, error, { category: LogCategory.DATABASE, action });
}

/** Reuse revokes the grant; logged with the grant id only. */
function logReuse(action: "mcp_oauth_code_reuse" | "mcp_oauth_refresh_reuse", grantId: string | null): void {
  loggerService.warn("OAuth credential reuse detected; grant revoked", {
    category: LogCategory.SECURITY,
    action,
    metadata: { grantId },
  });
}

function knownScopes(value: unknown): AgentTokenScope[] | null {
  return isStringArray(value) ? value.filter(isAgentTokenScope) : null;
}

/** True when the presented resource, if any, normalizes to `granted`. */
function resourceMatches(presented: string | null, granted: string): boolean {
  return presented === null || normalizeResource(presented) === granted;
}

/** Runs `run`, turning a thrown exception into `unavailable`. */
async function guardedGrant<T extends AgentOAuthIssuedTokens>(
  action: string,
  run: () => Promise<AgentOAuthTokenGrantResult<T>>
): Promise<AgentOAuthTokenGrantResult<T>> {
  try {
    return await run();
  } catch (error) {
    logDatabaseFailure("OAuth token grant threw", action, error);
    return UNAVAILABLE;
  }
}

// ── authorization_code ─────────────────────────────────────────────────────

interface CodeRow {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  resource: string;
}

type Lookup<T> = { kind: "found"; row: T } | { kind: "not_found" } | { kind: "unavailable" };

interface LookupQueryResult {
  data: unknown;
  error: unknown;
}

/**
 * Runs a single-row lookup within AGENT_OAUTH_DEADLINES_MS.dbRead, aborting it
 * at the deadline, and checks the row's shape. A query error, a timeout or an
 * unexpected shape is `unavailable` and logged (without token material).
 */
async function boundedLookup<T>(
  run: (signal: AbortSignal) => PromiseLike<LookupQueryResult>,
  isRow: (value: unknown) => value is T,
  log: { message: string; action: string; table: string }
): Promise<Lookup<T>> {
  const outcome = await withAbortableTimeout(async (signal) => await run(signal), AGENT_OAUTH_DEADLINES_MS.dbRead);
  if (outcome.timedOut) {
    logDatabaseFailure(log.message, log.action, `${log.table} lookup timed out`);
    return { kind: "unavailable" };
  }
  const { data, error } = outcome.value;
  if (error) {
    logDatabaseFailure(log.message, log.action, error);
    return { kind: "unavailable" };
  }
  if (data === null) return { kind: "not_found" };
  if (!isRow(data)) {
    logDatabaseFailure(log.message, log.action, `Unexpected ${log.table} row shape`);
    return { kind: "unavailable" };
  }
  return { kind: "found", row: data };
}

interface ExchangeRow {
  outcome: AgentOAuthExchangeOutcome;
  grant_id: string | null;
  user_id: string | null;
  client_name: string | null;
  scopes: unknown;
  access_expires_in: number | null;
}

const EXCHANGE_ACTION = "mcp_oauth_code_exchange_failed";

function isCodeRow(value: unknown): value is CodeRow {
  return (
    isPlainObject(value) &&
    ["client_id", "redirect_uri", "code_challenge", "resource"].every(
      (key) => typeof value[key] === "string"
    )
  );
}

function loadCode(admin: SupabaseClient, codeHash: string): Promise<Lookup<CodeRow>> {
  return boundedLookup(
    (signal) =>
      admin
        .from(AGENT_OAUTH_CODES_TABLE)
        .select(CODE_SELECT)
        .eq("code_hash", codeHash)
        .abortSignal(signal)
        .maybeSingle(),
    isCodeRow,
    { message: "OAuth code lookup failed", action: EXCHANGE_ACTION, table: AGENT_OAUTH_CODES_TABLE }
  );
}

/**
 * The first reason the code can't be exchanged by this request, checked
 * before the database function so a mismatch has no side effects. The code
 * stores the registered redirect URI; the request may present it with a
 * different loopback port, as the authorization request could.
 */
function codeMismatch(
  row: CodeRow,
  client: AgentOAuthClientRecord,
  request: CodeExchangeRequest
): Rejected | null {
  if (row.client_id !== client.client_id) return rejectCode("client_mismatch");
  if (matchRegisteredRedirectUri(request.redirectUri, [row.redirect_uri]) === null) {
    return rejectCode("redirect_uri_mismatch");
  }
  if (!verifyPkceS256(request.codeVerifier, row.code_challenge)) return rejectCode("pkce_failed");
  if (!resourceMatches(request.resource, row.resource)) {
    return reject("invalid_target", DESCRIPTIONS.resource, "resource_mismatch");
  }
  return null;
}

function isExchangeOutcome(value: unknown): value is AgentOAuthExchangeOutcome {
  return AGENT_OAUTH_EXCHANGE_OUTCOMES.some((outcome) => outcome === value);
}

function isExchangeRow(value: unknown): value is ExchangeRow {
  return (
    isPlainObject(value) &&
    isExchangeOutcome(value.outcome) &&
    isNullableString(value.grant_id) &&
    isNullableString(value.user_id) &&
    isNullableString(value.client_name) &&
    (value.access_expires_in === null || typeof value.access_expires_in === "number")
  );
}

function exchangedTokens(
  row: ExchangeRow,
  accessToken: string,
  refreshToken: string | null
): AgentOAuthCodeExchangeTokens | null {
  const scopes = knownScopes(row.scopes);
  if (
    row.grant_id === null ||
    row.user_id === null ||
    row.client_name === null ||
    row.access_expires_in === null ||
    scopes === null
  ) {
    return null;
  }
  return {
    accessToken,
    refreshToken,
    expiresIn: row.access_expires_in,
    scopes,
    grantId: row.grant_id,
    userId: row.user_id,
    clientName: row.client_name,
  };
}

function exchangeResult(
  row: ExchangeRow,
  accessToken: string,
  refreshToken: string | null
): AgentOAuthTokenGrantResult<AgentOAuthCodeExchangeTokens> {
  switch (row.outcome) {
    case "ok": {
      const tokens = exchangedTokens(row, accessToken, refreshToken);
      if (tokens !== null) return { ok: true, tokens };
      logDatabaseFailure("OAuth code exchange failed", EXCHANGE_ACTION, "Incomplete exchange_agent_oauth_code result");
      return UNAVAILABLE;
    }
    case "invalid_grant":
      return rejectCode("code_invalid");
    case "code_reuse":
      logReuse("mcp_oauth_code_reuse", row.grant_id);
      return rejectCode("code_reuse");
    case "grant_cap":
      return reject("invalid_grant", AGENT_OAUTH_GRANT_CAP_DESCRIPTION, "grant_cap");
  }
}

function registeredRefreshGrant(client: AgentOAuthClientRecord): boolean {
  return client.grant_types.some((grantType) => grantType === AGENT_OAUTH_GRANT_TYPE.refreshToken);
}

async function exchange(
  admin: SupabaseClient,
  client: AgentOAuthClientRecord,
  request: CodeExchangeRequest
): Promise<AgentOAuthTokenGrantResult<AgentOAuthCodeExchangeTokens>> {
  if (!hasValidPrefixedSecretFormat(request.code, AGENT_OAUTH_PREFIXES.authorizationCode)) {
    return rejectCode("malformed_code");
  }
  const codeHash = hashSecret(request.code);
  const code = await loadCode(admin, codeHash);
  if (code.kind === "unavailable") return UNAVAILABLE;
  if (code.kind === "not_found") return rejectCode("unknown_code");
  const mismatch = codeMismatch(code.row, client, request);
  if (mismatch !== null) return mismatch;

  const issueRefresh = registeredRefreshGrant(client);
  const access = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken);
  const refresh = issueRefresh ? generatePrefixedSecret(AGENT_OAUTH_PREFIXES.refreshToken) : null;
  const { data, error } = await admin
    .rpc(AGENT_OAUTH_RPC.exchangeCode, {
      p_code_hash: codeHash,
      p_client_id: client.client_id,
      p_access_hash: access.hash,
      p_refresh_hash: refresh?.hash ?? null,
      p_issue_refresh: issueRefresh,
    })
    .single();
  if (error || !isExchangeRow(data)) {
    logDatabaseFailure("OAuth code exchange failed", EXCHANGE_ACTION, error ?? "Unexpected exchange_agent_oauth_code result");
    return UNAVAILABLE;
  }
  return exchangeResult(data, access.raw, refresh?.raw ?? null);
}

/**
 * Exchange an authorization code for tokens (OAuth 2.1 §4.1.3) for an
 * authenticated client. The code must be this client's, `redirectUri` must
 * match the registered one it was issued for (loopback ports may differ),
 * PKCE must verify and a presented resource must normalize to the code's.
 * Only then does exchange_agent_oauth_code run. A refresh token is issued
 * only when the client registered the refresh_token grant.
 */
export async function exchangeAuthorizationCode(
  admin: SupabaseClient,
  client: AgentOAuthClientRecord,
  request: CodeExchangeRequest
): Promise<AgentOAuthTokenGrantResult<AgentOAuthCodeExchangeTokens>> {
  return guardedGrant(EXCHANGE_ACTION, () => exchange(admin, client, request));
}

// ── refresh_token ──────────────────────────────────────────────────────────

interface RefreshTokenRow {
  kind: string;
  grant: { client_id: string; resource: string; scopes: AgentTokenScope[] } | null;
}

interface RotateRow {
  outcome: AgentOAuthRotateOutcome;
  grant_id: string | null;
  user_id: string | null;
  scopes: unknown;
  access_expires_in: number | null;
}

const REFRESH_ACTION = "mcp_oauth_refresh_failed";

function isRefreshGrant(value: unknown): value is NonNullable<RefreshTokenRow["grant"]> {
  return (
    isPlainObject(value) &&
    typeof value.client_id === "string" &&
    typeof value.resource === "string" &&
    isStringArray(value.scopes)
  );
}

function isRefreshTokenRow(value: unknown): value is RefreshTokenRow {
  return (
    isPlainObject(value) &&
    typeof value.kind === "string" &&
    (value.grant === null || isRefreshGrant(value.grant))
  );
}

function loadRefreshToken(admin: SupabaseClient, tokenHash: string): Promise<Lookup<RefreshTokenRow>> {
  return boundedLookup(
    (signal) =>
      admin
        .from(AGENT_OAUTH_TOKENS_TABLE)
        .select(REFRESH_TOKEN_SELECT)
        .eq("token_hash", tokenHash)
        .abortSignal(signal)
        .maybeSingle(),
    isRefreshTokenRow,
    { message: "OAuth refresh token lookup failed", action: REFRESH_ACTION, table: AGENT_OAUTH_TOKENS_TABLE }
  );
}

/**
 * The first reason this refresh can't proceed, checked before rotation so a
 * mismatch has no side effects. Unknown scope values are ignored; the known
 * ones must all be granted. The grant's scopes are issued either way.
 */
function refreshMismatch(
  row: RefreshTokenRow,
  client: AgentOAuthClientRecord,
  request: RefreshRequest
): Rejected | null {
  const grant = row.grant;
  if (row.kind !== AGENT_OAUTH_TOKEN_KIND.refresh || grant === null || grant.client_id !== client.client_id) {
    return rejectRefresh("unknown_refresh_token");
  }
  if (!resourceMatches(request.resource, grant.resource)) {
    return reject("invalid_target", DESCRIPTIONS.resource, "resource_mismatch");
  }
  const requested = requestedKnownScopes(request.scope);
  if (!requested.every((scope) => grant.scopes.includes(scope))) {
    return reject("invalid_scope", DESCRIPTIONS.scope, "scope_not_granted");
  }
  return null;
}

function isRotateOutcome(value: unknown): value is AgentOAuthRotateOutcome {
  return AGENT_OAUTH_ROTATE_OUTCOMES.some((outcome) => outcome === value);
}

function isRotateRow(value: unknown): value is RotateRow {
  return (
    isPlainObject(value) &&
    isRotateOutcome(value.outcome) &&
    isNullableString(value.grant_id) &&
    isNullableString(value.user_id) &&
    (value.access_expires_in === null || typeof value.access_expires_in === "number")
  );
}

function rotatedTokens(
  row: RotateRow,
  accessToken: string,
  refreshToken: string
): AgentOAuthIssuedTokens | null {
  const scopes = knownScopes(row.scopes);
  if (row.grant_id === null || row.user_id === null || row.access_expires_in === null || scopes === null) {
    return null;
  }
  return {
    accessToken,
    refreshToken,
    expiresIn: row.access_expires_in,
    scopes,
    grantId: row.grant_id,
    userId: row.user_id,
  };
}

function rotateResult(
  row: RotateRow,
  accessToken: string,
  refreshToken: string
): AgentOAuthTokenGrantResult<AgentOAuthIssuedTokens> {
  switch (row.outcome) {
    case "ok": {
      const tokens = rotatedTokens(row, accessToken, refreshToken);
      if (tokens !== null) return { ok: true, tokens };
      logDatabaseFailure("OAuth refresh failed", REFRESH_ACTION, "Incomplete rotate_agent_oauth_refresh result");
      return UNAVAILABLE;
    }
    case "invalid_grant":
      return rejectRefresh("refresh_invalid");
    case "refresh_reuse":
      logReuse("mcp_oauth_refresh_reuse", row.grant_id);
      return rejectRefresh("refresh_reuse");
  }
}

async function refresh(
  admin: SupabaseClient,
  client: AgentOAuthClientRecord,
  request: RefreshRequest
): Promise<AgentOAuthTokenGrantResult<AgentOAuthIssuedTokens>> {
  if (!registeredRefreshGrant(client)) {
    return reject("unauthorized_client", DESCRIPTIONS.refreshNotRegistered, "refresh_not_registered");
  }
  if (!hasValidPrefixedSecretFormat(request.refreshToken, AGENT_OAUTH_PREFIXES.refreshToken)) {
    return rejectRefresh("malformed_refresh_token");
  }
  const refreshHash = hashSecret(request.refreshToken);
  const token = await loadRefreshToken(admin, refreshHash);
  if (token.kind === "unavailable") return UNAVAILABLE;
  if (token.kind === "not_found") return rejectRefresh("unknown_refresh_token");
  const mismatch = refreshMismatch(token.row, client, request);
  if (mismatch !== null) return mismatch;

  const access = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken);
  const next = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.refreshToken);
  const { data, error } = await admin
    .rpc(AGENT_OAUTH_RPC.rotateRefresh, {
      p_refresh_hash: refreshHash,
      p_client_id: client.client_id,
      p_new_access_hash: access.hash,
      p_new_refresh_hash: next.hash,
    })
    .single();
  if (error || !isRotateRow(data)) {
    logDatabaseFailure("OAuth refresh failed", REFRESH_ACTION, error ?? "Unexpected rotate_agent_oauth_refresh result");
    return UNAVAILABLE;
  }
  return rotateResult(data, access.raw, next.raw);
}

/**
 * Rotate a refresh token (OAuth 2.1 §4.3) for an authenticated client that
 * registered the refresh_token grant. A presented resource must normalize to
 * the grant's, and a presented scope may name only granted scopes (unknown
 * values ignored). Then rotate_agent_oauth_refresh runs, which applies the
 * grace window and revokes the grant on reuse.
 */
export async function refreshTokens(
  admin: SupabaseClient,
  client: AgentOAuthClientRecord,
  request: RefreshRequest
): Promise<AgentOAuthTokenGrantResult<AgentOAuthIssuedTokens>> {
  return guardedGrant(REFRESH_ACTION, () => refresh(admin, client, request));
}

// ── revocation ─────────────────────────────────────────────────────────────

const REVOKE_ACTION = "mcp_oauth_token_revoke_failed";
const NOTHING_REVOKED: AgentOAuthTokenRevocation = { ok: true, outcome: "not_found", grantId: null };

function isRevokeOutcome(value: unknown): value is AgentOAuthRevokeOutcome {
  return AGENT_OAUTH_REVOKE_OUTCOMES.some((outcome) => outcome === value);
}

function isOAuthTokenFormat(raw: string): boolean {
  return (
    hasValidPrefixedSecretFormat(raw, AGENT_OAUTH_PREFIXES.accessToken) ||
    hasValidPrefixedSecretFormat(raw, AGENT_OAUTH_PREFIXES.refreshToken)
  );
}

async function revoke(
  admin: SupabaseClient,
  clientId: string,
  rawToken: string
): Promise<AgentOAuthTokenRevocation> {
  if (!isOAuthTokenFormat(rawToken)) return NOTHING_REVOKED;
  const { data, error } = await admin
    .rpc(AGENT_OAUTH_RPC.revokeToken, { p_token_hash: hashSecret(rawToken), p_client_id: clientId })
    .single();
  const outcome = isPlainObject(data) ? data.outcome : undefined;
  const grantId = isPlainObject(data) ? data.grant_id : undefined;
  if (error || !isRevokeOutcome(outcome) || !isNullableString(grantId)) {
    logDatabaseFailure("OAuth token revocation failed", REVOKE_ACTION, error ?? "Unexpected revoke_agent_oauth_token result");
    return UNAVAILABLE;
  }
  return { ok: true, outcome, grantId };
}

/**
 * RFC 7009: revoke the whole grant behind an access or refresh token, when
 * the token belongs to `clientId`. A token that isn't ours, isn't this
 * client's or is unknown revokes nothing and is `not_found`.
 */
export async function revokeClientToken(
  admin: SupabaseClient,
  clientId: string,
  rawToken: string
): Promise<AgentOAuthTokenRevocation> {
  try {
    return await revoke(admin, clientId, rawToken);
  } catch (error) {
    logDatabaseFailure("OAuth token revocation threw", REVOKE_ACTION, error);
    return UNAVAILABLE;
  }
}

// ── access-token lookup (the MCP route) ────────────────────────────────────

interface AccessGrant {
  id: string;
  user_id: string;
  scopes: string[];
  last_used_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

interface AccessTokenRow {
  expires_at: string;
  grant: AccessGrant | null;
}

const LOOKUP_ACTION = "mcp_oauth_access_lookup_failed";

function isAccessGrant(value: unknown): value is AccessGrant {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    isStringArray(value.scopes) &&
    typeof value.last_used_at === "string" &&
    isNullableString(value.expires_at) &&
    isNullableString(value.revoked_at)
  );
}

function isAccessTokenRow(value: unknown): value is AccessTokenRow {
  return (
    isPlainObject(value) &&
    typeof value.expires_at === "string" &&
    (value.grant === null || isAccessGrant(value.grant))
  );
}

function accessLookupFromRow(row: AccessTokenRow, now: Date): AgentOAuthAccessTokenLookup {
  const grant = row.grant;
  if (grant === null) return { kind: "not_found" };
  if (grant.revoked_at !== null) return { kind: "revoked" };
  if (isExpiredAt(row.expires_at, now) || isExpiredAt(grant.expires_at, now)) return { kind: "expired" };
  return {
    kind: "active",
    grantId: grant.id,
    userId: grant.user_id,
    scopes: grant.scopes.filter(isAgentTokenScope),
    lastUsedAt: new Date(grant.last_used_at),
  };
}

async function lookupAccess(
  admin: SupabaseClient,
  tokenHash: string,
  now: Date,
  signal: AbortSignal | undefined
): Promise<AgentOAuthAccessTokenLookup> {
  const query = admin
    .from(AGENT_OAUTH_TOKENS_TABLE)
    .select(ACCESS_TOKEN_SELECT)
    .eq("token_hash", tokenHash)
    .eq("kind", AGENT_OAUTH_TOKEN_KIND.access);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  // The caller aborted because it stopped waiting and already reported why.
  if (signal?.aborted) return { kind: "unavailable" };
  if (error) {
    logDatabaseFailure("OAuth access token lookup failed", LOOKUP_ACTION, error);
    return { kind: "unavailable" };
  }
  if (data === null) return { kind: "not_found" };
  if (!isAccessTokenRow(data)) {
    logDatabaseFailure("OAuth access token lookup failed", LOOKUP_ACTION, "Unexpected agent_oauth_tokens row shape");
    return { kind: "unavailable" };
  }
  return accessLookupFromRow(data, now);
}

/**
 * Look up an access token by its SHA-256 digest, joined to its grant, and say
 * whether it's active at `now`. Aborting `signal` cancels the query and yields
 * `unavailable`. The caller checks the `co_oat_` format and checksum first.
 */
export async function lookupAccessToken(
  admin: SupabaseClient,
  tokenHash: string,
  now: Date = new Date(),
  signal?: AbortSignal
): Promise<AgentOAuthAccessTokenLookup> {
  try {
    return await lookupAccess(admin, tokenHash, now, signal);
  } catch (error) {
    if (signal?.aborted) return { kind: "unavailable" };
    logDatabaseFailure("OAuth access token lookup threw", LOOKUP_ACTION, error);
    return { kind: "unavailable" };
  }
}

function logTouchFailure(grantId: string, error: unknown): void {
  loggerService.error("Failed to update OAuth grant last_used_at", error, {
    category: LogCategory.DATABASE,
    action: "mcp_oauth_grant_touch_failed",
    metadata: { grantId },
  });
}

/**
 * Record that a grant was used, at most once per LAST_USED_TOUCH_INTERVAL_MS,
 * like touchLastUsed for PATs. Never rejects, so callers can hand it to
 * after() without a catch.
 */
export async function touchGrantLastUsed(
  admin: SupabaseClient,
  grantId: string,
  lastUsedAt: Date | null,
  now: Date
): Promise<void> {
  if (lastUsedAt !== null && now.getTime() - lastUsedAt.getTime() < LAST_USED_TOUCH_INTERVAL_MS) {
    return;
  }
  try {
    const { error } = await admin
      .from(AGENT_OAUTH_GRANTS_TABLE)
      .update({ last_used_at: now.toISOString() })
      .eq("id", grantId);
    if (error) logTouchFailure(grantId, error);
  } catch (error) {
    logTouchFailure(grantId, error);
  }
}
