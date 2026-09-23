/**
 * Personal access tokens for CareerOtter agents (the MCP server).
 *
 * Token format: `co_pat_` + base64url(32 random bytes) + `_` + checksum, where
 * the checksum is the CRC32 of everything before the final underscore, in
 * base36. The checksum lets the MCP route reject typos and junk without a
 * database query, and makes leaked tokens recognizable to secret scanners.
 *
 * Only the SHA-256 hash is stored (agent_tokens.token_hash); lookup is by hash
 * through its unique index. Service functions take the service-role admin
 * client, scope every query to the acting user, and never throw.
 */

import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_COMP_SCOPES,
  AGENT_TOKEN_CHECKSUM_LENGTH,
  AGENT_TOKEN_EXPIRY_DAYS_OPTIONS,
  AGENT_TOKEN_LIMITS,
  AGENT_TOKEN_PREFIX,
  AGENT_TOKEN_SCOPES,
  AGENT_TOKEN_SECRET_BYTES,
  DEFAULT_AGENT_TOKEN_EXPIRY_DAYS,
  LAST_USED_TOUCH_INTERVAL_MS,
  SCOPE_IMPLIES,
  type AgentTokenExpiryDays,
} from "@/lib/constants/agent-access";
import { isValidUUID } from "@/lib/utils/api-validation";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type {
  AgentTokenRecord,
  AgentTokenScope,
  AgentTokenStatus,
  DomainResult,
} from "@/types";

/** A freshly minted token. `raw` is shown to the user once and never stored. */
export interface GeneratedAgentToken {
  raw: string;
  hash: string;
  prefix: string;
}

export type AgentTokenVerification =
  | {
      ok: true;
      userId: string;
      tokenId: string;
      scopes: AgentTokenScope[];
      expiresAt: Date | null;
      lastUsedAt: Date | null;
    }
  | { ok: false; reason: "invalid" | "unavailable" };

export interface CreatedAgentToken {
  token: string;
  record: AgentTokenRecord;
}

/** An agent_tokens row as selected by this module (never includes token_hash). */
interface AgentTokenRow {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface FailureContext {
  userId: string;
  action: string;
  logMessage: string;
  publicMessage: string;
}

const TOKEN_TABLE = "agent_tokens";
const TOKEN_SELECT =
  "id, user_id, name, token_prefix, scopes, created_at, last_used_at, expires_at, revoked_at";
const ACTIVE_NAME_CONSTRAINT = "agent_tokens_user_active_name_key";
const UNIQUE_VIOLATION_CODE = "23505";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNEXPECTED_ROW_SHAPE = "Unexpected agent_tokens row shape";
const BASE36_RADIX = 36;
const CHECKSUM_SEPARATOR = "_";

// base64url without padding: 4 characters per 3 bytes, rounded up.
const SECRET_LENGTH = Math.ceil((AGENT_TOKEN_SECRET_BYTES * 4) / 3);
const TOKEN_PATTERN = new RegExp(
  `^${AGENT_TOKEN_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}}${CHECKSUM_SEPARATOR}[0-9a-z]{${AGENT_TOKEN_CHECKSUM_LENGTH}}$`
);

// Standard (IEEE 802.3, reflected) CRC32. Implemented here because the
// installed Node typings predate zlib.crc32.
const CRC32_POLYNOMIAL = 0xedb88320;
const CRC32_INITIAL = 0xffffffff;
const CRC32_TABLE = buildCrc32Table();

const MESSAGES = {
  scopesRequired: `scopes must be a non-empty array of: ${AGENT_TOKEN_SCOPES.join(", ")}`,
  nameInvalid: `name must be 1 to ${AGENT_TOKEN_LIMITS.nameMax} characters`,
  expiryInvalid: `expires_in_days must be one of ${AGENT_TOKEN_EXPIRY_DAYS_OPTIONS.join(", ")} or null`,
  compNeverExpires: "Tokens with a comp scope must have an expiry",
  nameTaken: "An active token with this name already exists",
  limitReached: `You can have at most ${AGENT_TOKEN_LIMITS.maxActivePerUser} active tokens; revoke one first`,
  notFound: "Token not found",
  loadFailed: "Failed to load tokens",
  createFailed: "Failed to create token",
  revokeFailed: "Failed to revoke token",
} as const;

// ── result helpers ─────────────────────────────────────────────────────────

function ok<T>(value: T): DomainResult<T> {
  return { ok: true, value };
}

function invalid<T>(message: string): DomainResult<T> {
  return { ok: false, kind: "validation", message };
}

function notFound<T>(): DomainResult<T> {
  return { ok: false, kind: "not_found", message: MESSAGES.notFound };
}

function dbFailure<T>(context: FailureContext, error: unknown): DomainResult<T> {
  loggerService.error(context.logMessage, error, {
    category: LogCategory.DATABASE,
    userId: context.userId,
    action: context.action,
  });
  return { ok: false, kind: "db", message: context.publicMessage };
}

async function guarded<T>(
  context: FailureContext,
  run: () => Promise<DomainResult<T>>
): Promise<DomainResult<T>> {
  try {
    return await run();
  } catch (error) {
    return dbFailure(context, error);
  }
}

// ── format ─────────────────────────────────────────────────────────────────

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < table.length; n++) {
    let crc = n;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? CRC32_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
    }
    table[n] = crc >>> 0;
  }
  return table;
}

function crc32(text: string): number {
  let crc = CRC32_INITIAL;
  for (const byte of Buffer.from(text, "utf8")) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ CRC32_INITIAL) >>> 0;
}

function checksumOf(body: string): string {
  return crc32(body)
    .toString(BASE36_RADIX)
    .padStart(AGENT_TOKEN_CHECKSUM_LENGTH, "0");
}

/** Mint a new token. Store only `hash` and `prefix`; show `raw` once. */
export function generateAgentToken(): GeneratedAgentToken {
  const body =
    AGENT_TOKEN_PREFIX + randomBytes(AGENT_TOKEN_SECRET_BYTES).toString("base64url");
  const raw = `${body}${CHECKSUM_SEPARATOR}${checksumOf(body)}`;
  return {
    raw,
    hash: hashAgentToken(raw),
    prefix: raw.slice(0, AGENT_TOKEN_LIMITS.displayPrefixLength),
  };
}

/** True when `raw` has the token shape and a matching checksum. No DB access. */
export function hasValidAgentTokenFormat(raw: unknown): raw is string {
  if (typeof raw !== "string" || !TOKEN_PATTERN.test(raw)) return false;
  const separatorIndex = raw.lastIndexOf(CHECKSUM_SEPARATOR);
  return checksumOf(raw.slice(0, separatorIndex)) === raw.slice(separatorIndex + 1);
}

/** SHA-256 hex of the full raw token, as stored in agent_tokens.token_hash. */
export function hashAgentToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

// ── scopes ─────────────────────────────────────────────────────────────────

export function isAgentTokenScope(value: unknown): value is AgentTokenScope {
  return AGENT_TOKEN_SCOPES.some((scope) => scope === value);
}

function impliedScopes(scope: AgentTokenScope): readonly AgentTokenScope[] {
  return SCOPE_IMPLIES[scope] ?? [];
}

/**
 * Validate requested scopes: a non-empty array of known scopes. Dedupes, adds
 * the reads implied by writes, and sorts in AGENT_TOKEN_SCOPES order.
 */
export function normalizeScopes(input: unknown): DomainResult<AgentTokenScope[]> {
  if (!Array.isArray(input) || input.length === 0) {
    return invalid(MESSAGES.scopesRequired);
  }
  const granted = new Set<AgentTokenScope>();
  for (const scope of input) {
    if (!isAgentTokenScope(scope)) return invalid(`Unknown scope: ${String(scope)}`);
    granted.add(scope);
    impliedScopes(scope).forEach((implied) => granted.add(implied));
  }
  return ok(AGENT_TOKEN_SCOPES.filter((scope) => granted.has(scope)));
}

/** True when `scopes` grant `required`, directly or through implication. */
export function hasScope(
  scopes: readonly AgentTokenScope[],
  required: AgentTokenScope
): boolean {
  return scopes.some(
    (scope) => scope === required || impliedScopes(scope).includes(required)
  );
}

// ── rows ───────────────────────────────────────────────────────────────────

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAgentTokenRow(value: unknown): value is AgentTokenRow {
  if (typeof value !== "object" || value === null) return false;
  const row: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  return (
    ["id", "user_id", "name", "token_prefix", "created_at"].every(
      (key) => typeof row[key] === "string"
    ) &&
    isStringArray(row.scopes) &&
    ["last_used_at", "expires_at", "revoked_at"].every((key) =>
      isNullableString(row[key])
    )
  );
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/** Status of a token at `now`: revocation wins over expiry. */
export function agentTokenStatus(
  row: Pick<AgentTokenRow, "expires_at" | "revoked_at">,
  now: Date
): AgentTokenStatus {
  if (row.revoked_at !== null) return "revoked";
  if (row.expires_at !== null && Date.parse(row.expires_at) <= now.getTime()) {
    return "expired";
  }
  return "active";
}

function toAgentTokenRecord(row: AgentTokenRow, now: Date): AgentTokenRecord {
  return {
    id: row.id,
    name: row.name,
    token_prefix: row.token_prefix,
    scopes: row.scopes.filter(isAgentTokenScope),
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    status: agentTokenStatus(row, now),
  };
}

// PostgREST `or` filter matching tokens that have not expired at `now`. The
// timestamp is quoted because it contains PostgREST-reserved characters.
function notExpiredFilter(now: Date): string {
  return `expires_at.is.null,expires_at.gt."${now.toISOString()}"`;
}

// ── verification ───────────────────────────────────────────────────────────

const UNAVAILABLE: AgentTokenVerification = { ok: false, reason: "unavailable" };
const INVALID: AgentTokenVerification = { ok: false, reason: "invalid" };

function logVerifyFailure(message: string, error: unknown): void {
  // Never include the token or its hash: either would identify the credential.
  loggerService.error(message, error, {
    category: LogCategory.AUTH,
    action: "agent_token_verify_failed",
  });
}

async function findTokenByHash(
  admin: SupabaseClient,
  hash: string
): Promise<{ row: unknown; error: unknown }> {
  const { data, error } = await admin
    .from(TOKEN_TABLE)
    .select(TOKEN_SELECT)
    .eq("token_hash", hash)
    .maybeSingle();
  return { row: data, error };
}

function verificationFromRow(row: AgentTokenRow, now: Date): AgentTokenVerification {
  if (agentTokenStatus(row, now) !== "active") return INVALID;
  return {
    ok: true,
    userId: row.user_id,
    tokenId: row.id,
    scopes: row.scopes.filter(isAgentTokenScope),
    expiresAt: toDateOrNull(row.expires_at),
    lastUsedAt: toDateOrNull(row.last_used_at),
  };
}

/**
 * Resolve a raw bearer token to its owner and scopes. `invalid` means reject
 * with 401 (bad format, unknown, revoked, expired); `unavailable` means the
 * database could not be reached and the caller should answer 503.
 */
export async function verifyAgentToken(
  admin: SupabaseClient,
  raw: unknown,
  now: Date = new Date()
): Promise<AgentTokenVerification> {
  if (!hasValidAgentTokenFormat(raw)) return INVALID;
  try {
    const { row, error } = await findTokenByHash(admin, hashAgentToken(raw));
    if (error) {
      logVerifyFailure("Agent token lookup failed", error);
      return UNAVAILABLE;
    }
    if (row === null) return INVALID;
    if (!isAgentTokenRow(row)) {
      logVerifyFailure("Agent token row has an unexpected shape", null);
      return UNAVAILABLE;
    }
    return verificationFromRow(row, now);
  } catch (error) {
    logVerifyFailure("Agent token lookup threw", error);
    return UNAVAILABLE;
  }
}

function logTouchFailure(tokenId: string, error: unknown): void {
  loggerService.error("Failed to update agent token last_used_at", error, {
    category: LogCategory.DATABASE,
    action: "agent_token_touch_failed",
    metadata: { tokenId },
  });
}

/**
 * Record that a token was used, at most once per LAST_USED_TOUCH_INTERVAL_MS.
 * Never rejects, so callers can hand it to after() without a catch.
 */
export async function touchLastUsed(
  admin: SupabaseClient,
  tokenId: string,
  lastUsedAt: Date | null,
  now: Date
): Promise<void> {
  if (
    lastUsedAt !== null &&
    now.getTime() - lastUsedAt.getTime() < LAST_USED_TOUCH_INTERVAL_MS
  ) {
    return;
  }
  try {
    const { error } = await admin
      .from(TOKEN_TABLE)
      .update({ last_used_at: now.toISOString() })
      .eq("id", tokenId);
    if (error) logTouchFailure(tokenId, error);
  } catch (error) {
    logTouchFailure(tokenId, error);
  }
}

// ── token API services ─────────────────────────────────────────────────────

function rowsToRecords(rows: unknown, now: Date): AgentTokenRecord[] | null {
  if (!Array.isArray(rows) || !rows.every(isAgentTokenRow)) return null;
  return rows.map((row) => toAgentTokenRecord(row, now));
}

/** All of the user's tokens, newest first, with computed status. */
export async function listAgentTokens(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<DomainResult<AgentTokenRecord[]>> {
  const context: FailureContext = {
    userId,
    action: "agent_tokens_list_failed",
    logMessage: "Failed to list agent tokens",
    publicMessage: MESSAGES.loadFailed,
  };
  return guarded(context, async () => {
    const { data, error } = await admin
      .from(TOKEN_TABLE)
      .select(TOKEN_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return dbFailure(context, error);
    const records = rowsToRecords(data, now);
    return records ? ok(records) : dbFailure(context, UNEXPECTED_ROW_SHAPE);
  });
}

interface ValidatedTokenInput {
  name: string;
  scopes: AgentTokenScope[];
  expiresInDays: AgentTokenExpiryDays | null;
}

function toFields(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(Object.entries(raw));
}

function parseName(raw: unknown): DomainResult<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > AGENT_TOKEN_LIMITS.nameMax) {
    return invalid(MESSAGES.nameInvalid);
  }
  return ok(name);
}

function parseExpiryDays(raw: unknown): DomainResult<AgentTokenExpiryDays | null> {
  if (raw === undefined) return ok(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
  if (raw === null) return ok(null);
  const option = AGENT_TOKEN_EXPIRY_DAYS_OPTIONS.find((days) => days === raw);
  return option === undefined ? invalid(MESSAGES.expiryInvalid) : ok(option);
}

function validateTokenInput(raw: unknown): DomainResult<ValidatedTokenInput> {
  const fields = toFields(raw);
  const name = parseName(fields.name);
  if (!name.ok) return name;
  const scopes = normalizeScopes(fields.scopes);
  if (!scopes.ok) return scopes;
  const expiresInDays = parseExpiryDays(fields.expires_in_days);
  if (!expiresInDays.ok) return expiresInDays;
  const hasCompScope = scopes.value.some((scope) => AGENT_COMP_SCOPES.includes(scope));
  if (expiresInDays.value === null && hasCompScope) {
    return invalid(MESSAGES.compNeverExpires);
  }
  return ok({ name: name.value, scopes: scopes.value, expiresInDays: expiresInDays.value });
}

async function countActiveTokens(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<{ count: number | null; error: unknown }> {
  const { count, error } = await admin
    .from(TOKEN_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .or(notExpiredFilter(now));
  return { count, error };
}

interface PostgrestErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function isActiveNameConflict(error: PostgrestErrorLike): boolean {
  if (error.code !== UNIQUE_VIOLATION_CODE) return false;
  return [error.message, error.details].some(
    (text) => typeof text === "string" && text.includes(ACTIVE_NAME_CONSTRAINT)
  );
}

function expiresAtFor(days: AgentTokenExpiryDays | null, now: Date): string | null {
  return days === null ? null : new Date(now.getTime() + days * MS_PER_DAY).toISOString();
}

async function insertToken(
  admin: SupabaseClient,
  userId: string,
  input: ValidatedTokenInput,
  now: Date,
  context: FailureContext
): Promise<DomainResult<CreatedAgentToken>> {
  const generated = generateAgentToken();
  const { data, error } = await admin
    .from(TOKEN_TABLE)
    .insert({
      user_id: userId,
      name: input.name,
      token_hash: generated.hash,
      token_prefix: generated.prefix,
      scopes: input.scopes,
      expires_at: expiresAtFor(input.expiresInDays, now),
    })
    .select(TOKEN_SELECT)
    .single();
  if (error) {
    if (isActiveNameConflict(error)) {
      return { ok: false, kind: "conflict", message: MESSAGES.nameTaken };
    }
    return dbFailure(context, error);
  }
  if (!isAgentTokenRow(data)) return dbFailure(context, UNEXPECTED_ROW_SHAPE);
  return ok({ token: generated.raw, record: toAgentTokenRecord(data, now) });
}

/**
 * Validate and create a token. Fails with `quota` at the active-token limit
 * (count-then-insert, so a race can exceed it by one) and `conflict` when an
 * active token already has the name. The raw token is returned only here.
 */
export async function createAgentToken(
  admin: SupabaseClient,
  userId: string,
  input: unknown,
  now: Date
): Promise<DomainResult<CreatedAgentToken>> {
  const validated = validateTokenInput(input);
  if (!validated.ok) return validated;
  const context: FailureContext = {
    userId,
    action: "agent_token_create_failed",
    logMessage: "Failed to create agent token",
    publicMessage: MESSAGES.createFailed,
  };
  return guarded(context, async () => {
    const active = await countActiveTokens(admin, userId, now);
    if (active.error) return dbFailure(context, active.error);
    if (active.count === null) return dbFailure(context, "Active token count missing");
    if (active.count >= AGENT_TOKEN_LIMITS.maxActivePerUser) {
      return { ok: false, kind: "quota", message: MESSAGES.limitReached };
    }
    return insertToken(admin, userId, validated.value, now, context);
  });
}

async function loadOwnRecord(
  admin: SupabaseClient,
  userId: string,
  id: string,
  now: Date,
  context: FailureContext
): Promise<DomainResult<AgentTokenRecord>> {
  const { data, error } = await admin
    .from(TOKEN_TABLE)
    .select(TOKEN_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return notFound();
  if (!isAgentTokenRow(data)) return dbFailure(context, UNEXPECTED_ROW_SHAPE);
  return ok(toAgentTokenRecord(data, now));
}

/**
 * Revoke one of the user's tokens. Idempotent: an already revoked token keeps
 * its original revoked_at. Unknown, foreign or non-uuid ids are `not_found`.
 */
export async function revokeAgentToken(
  admin: SupabaseClient,
  userId: string,
  id: string,
  now: Date
): Promise<DomainResult<AgentTokenRecord>> {
  if (!isValidUUID(id)) return notFound();
  const context: FailureContext = {
    userId,
    action: "agent_token_revoke_failed",
    logMessage: "Failed to revoke agent token",
    publicMessage: MESSAGES.revokeFailed,
  };
  return guarded(context, async () => {
    const { error } = await admin
      .from(TOKEN_TABLE)
      .update({ revoked_at: now.toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("revoked_at", null);
    if (error) return dbFailure(context, error);
    return loadOwnRecord(admin, userId, id, now, context);
  });
}

/** Revoke every active token the user has; returns how many were revoked. */
export async function revokeAllAgentTokens(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<DomainResult<number>> {
  const context: FailureContext = {
    userId,
    action: "agent_tokens_revoke_all_failed",
    logMessage: "Failed to revoke all agent tokens",
    publicMessage: MESSAGES.revokeFailed,
  };
  return guarded(context, async () => {
    const { data, error } = await admin
      .from(TOKEN_TABLE)
      .update({ revoked_at: now.toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .or(notExpiredFilter(now))
      .select("id");
    if (error) return dbFailure(context, error);
    return ok(Array.isArray(data) ? data.length : 0);
  });
}
