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
  AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT,
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
import { MS_PER_DAY } from "@/lib/constants/dates";
import {
  codePointLength,
  conflict,
  dbFailure,
  guarded,
  hasControlCharacter,
  invalid,
  isPlainObject,
  isUniqueViolationOn,
  notFound,
  ok,
  overQuota,
  type FailureContext,
} from "@/lib/careerotter/domain-result";
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

/**
 * Outcome of revoking all of a user's tokens. `revoked` counts every token
 * revoked (expired ones included, so they stop holding their names);
 * `activeRevoked` counts only those that were still usable.
 */
export interface RevokeAllResult {
  revoked: number;
  activeRevoked: number;
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

type RevokedRow = Pick<AgentTokenRow, "id" | "expires_at">;

const TOKEN_TABLE = "agent_tokens";
const TOKEN_SELECT =
  "id, user_id, name, token_prefix, scopes, created_at, last_used_at, expires_at, revoked_at";
const REVOKED_SELECT = "id, expires_at";
const UNEXPECTED_ROW_SHAPE = "Unexpected agent_tokens row shape";
const MISSING_COUNT = "Active token count missing";
const BASE36_RADIX = 36;
const CHECKSUM_SEPARATOR = "_";
const WHITESPACE_RUN = /\s+/g;

// base64url without padding: 4 characters per 3 bytes, rounded up.
const SECRET_LENGTH = Math.ceil((AGENT_TOKEN_SECRET_BYTES * 4) / 3);
const TOKEN_PATTERN = new RegExp(
  `^${AGENT_TOKEN_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}}${CHECKSUM_SEPARATOR}[0-9a-z]{${AGENT_TOKEN_CHECKSUM_LENGTH}}$`
);

// Standard (IEEE 802.3, reflected) CRC32. Implemented here because the
// installed Node typings predate zlib.crc32.
const CRC32_POLYNOMIAL = 0xedb88320;
const CRC32_INITIAL = 0xffffffff;
const BYTE_VALUE_COUNT = 256;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const CRC32_TABLE = buildCrc32Table();

const MESSAGES = {
  bodyInvalid: "Request body must be a JSON object",
  scopesRequired: `scopes must be a non-empty array of: ${AGENT_TOKEN_SCOPES.join(", ")}`,
  nameInvalid: `name must be 1 to ${AGENT_TOKEN_LIMITS.nameMax} characters with no control characters`,
  expiryInvalid: `expires_in_days must be one of ${AGENT_TOKEN_EXPIRY_DAYS_OPTIONS.join(", ")} or null`,
  compNeverExpires: "Tokens with a comp scope must have an expiry",
  nameTaken: "An active token with this name already exists",
  limitReached: `You can have at most ${AGENT_TOKEN_LIMITS.maxActivePerUser} active tokens; revoke one first`,
  notFound: "Token not found",
  loadFailed: "Failed to load tokens",
  createFailed: "Failed to create token",
  revokeFailed: "Failed to revoke token",
} as const;

const FAILURES = {
  list: {
    action: "agent_tokens_list_failed",
    logMessage: "Failed to list agent tokens",
    publicMessage: MESSAGES.loadFailed,
  },
  create: {
    action: "agent_token_create_failed",
    logMessage: "Failed to create agent token",
    publicMessage: MESSAGES.createFailed,
  },
  revoke: {
    action: "agent_token_revoke_failed",
    logMessage: "Failed to revoke agent token",
    publicMessage: MESSAGES.revokeFailed,
  },
  revokeAll: {
    action: "agent_tokens_revoke_all_failed",
    logMessage: "Failed to revoke all agent tokens",
    publicMessage: MESSAGES.revokeFailed,
  },
} as const satisfies Record<string, Omit<FailureContext, "userId">>;

function failureContext(userId: string, operation: keyof typeof FAILURES): FailureContext {
  return { userId, ...FAILURES[operation] };
}

// ── format ─────────────────────────────────────────────────────────────────

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(BYTE_VALUE_COUNT);
  for (let n = 0; n < table.length; n++) {
    let crc = n;
    for (let bit = 0; bit < BITS_PER_BYTE; bit++) {
      crc = crc & 1 ? CRC32_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
    }
    table[n] = crc >>> 0;
  }
  return table;
}

function crc32(text: string): number {
  let crc = CRC32_INITIAL;
  for (const byte of Buffer.from(text, "utf8")) {
    crc = CRC32_TABLE[(crc ^ byte) & BYTE_MASK] ^ (crc >>> BITS_PER_BYTE);
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
  const requested: unknown[] = input;
  const granted = new Set<AgentTokenScope>();
  for (const scope of requested) {
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
  if (!isPlainObject(value)) return false;
  return (
    ["id", "user_id", "name", "token_prefix", "created_at"].every(
      (key) => typeof value[key] === "string"
    ) &&
    isStringArray(value.scopes) &&
    ["last_used_at", "expires_at", "revoked_at"].every((key) =>
      isNullableString(value[key])
    )
  );
}

function isRevokedRow(value: unknown): value is RevokedRow {
  return (
    isPlainObject(value) && typeof value.id === "string" && isNullableString(value.expires_at)
  );
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false;
  const items: unknown[] = value;
  return items.every(guard);
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function isExpired(expiresAt: string | null, now: Date): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= now.getTime();
}

/** Status of a token at `now`: revocation wins over expiry. */
export function agentTokenStatus(
  row: Pick<AgentTokenRow, "expires_at" | "revoked_at">,
  now: Date
): AgentTokenStatus {
  if (row.revoked_at !== null) return "revoked";
  return isExpired(row.expires_at, now) ? "expired" : "active";
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

async function lookupVerification(
  admin: SupabaseClient,
  raw: string,
  now: Date
): Promise<AgentTokenVerification> {
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
    return await lookupVerification(admin, raw, now);
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
  if (!isArrayOf(rows, isAgentTokenRow)) return null;
  return rows.map((row) => toAgentTokenRecord(row, now));
}

/** All of the user's tokens, newest first, with computed status. */
export async function listAgentTokens(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<DomainResult<AgentTokenRecord[]>> {
  const context = failureContext(userId, "list");
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

/**
 * Trimmed, with internal whitespace runs collapsed to one space. Control
 * characters (including NUL, tab and newline) are rejected rather than
 * collapsed so a name never hides line breaks. Length is in code points to
 * match the char_length CHECK. Names are case-sensitive.
 */
function parseName(raw: unknown): DomainResult<string> {
  if (typeof raw !== "string" || hasControlCharacter(raw)) {
    return invalid(MESSAGES.nameInvalid);
  }
  const name = raw.trim().replace(WHITESPACE_RUN, " ");
  const length = codePointLength(name);
  if (length === 0 || length > AGENT_TOKEN_LIMITS.nameMax) {
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

function hasCompScope(scopes: readonly AgentTokenScope[]): boolean {
  return scopes.some((scope) => AGENT_COMP_SCOPES.includes(scope));
}

function validateTokenInput(raw: unknown): DomainResult<ValidatedTokenInput> {
  if (!isPlainObject(raw)) return invalid(MESSAGES.bodyInvalid);
  const name = parseName(raw.name);
  if (!name.ok) return name;
  const scopes = normalizeScopes(raw.scopes);
  if (!scopes.ok) return scopes;
  const expiresInDays = parseExpiryDays(raw.expires_in_days);
  if (!expiresInDays.ok) return expiresInDays;
  if (expiresInDays.value === null && hasCompScope(scopes.value)) {
    return invalid(MESSAGES.compNeverExpires);
  }
  return ok({ name: name.value, scopes: scopes.value, expiresInDays: expiresInDays.value });
}

/**
 * Count-then-insert: concurrent creates can each pass this check, so the limit
 * can be exceeded by up to the number of parallel requests. The per-user
 * create rate limit bounds that when Redis is available.
 */
async function ensureBelowActiveLimit(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  context: FailureContext
): Promise<DomainResult<null>> {
  const { count, error } = await admin
    .from(TOKEN_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .or(notExpiredFilter(now));
  if (error) return dbFailure(context, error);
  if (count === null) return dbFailure(context, MISSING_COUNT);
  if (count >= AGENT_TOKEN_LIMITS.maxActivePerUser) return overQuota(MESSAGES.limitReached);
  return ok(null);
}

/**
 * The active-name index only exempts revoked rows, so an expired token would
 * otherwise hold its name forever. Revoking it frees the name for reuse.
 */
async function releaseExpiredName(
  admin: SupabaseClient,
  userId: string,
  name: string,
  now: Date,
  context: FailureContext
): Promise<DomainResult<null>> {
  const nowIso = now.toISOString();
  const { error } = await admin
    .from(TOKEN_TABLE)
    .update({ revoked_at: nowIso })
    .eq("user_id", userId)
    .eq("name", name)
    .is("revoked_at", null)
    .lte("expires_at", nowIso);
  return error ? dbFailure(context, error) : ok(null);
}

function expiresAtFor(days: AgentTokenExpiryDays | null, now: Date): string | null {
  return days === null ? null : new Date(now.getTime() + days * MS_PER_DAY).toISOString();
}

async function insertTokenRow(
  admin: SupabaseClient,
  userId: string,
  input: ValidatedTokenInput,
  generated: GeneratedAgentToken,
  now: Date
): Promise<{ data: unknown; error: unknown }> {
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
  return { data, error };
}

async function insertToken(
  admin: SupabaseClient,
  userId: string,
  input: ValidatedTokenInput,
  now: Date,
  context: FailureContext
): Promise<DomainResult<CreatedAgentToken>> {
  const generated = generateAgentToken();
  const { data, error } = await insertTokenRow(admin, userId, input, generated, now);
  if (isUniqueViolationOn(error, AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT)) {
    return conflict(MESSAGES.nameTaken);
  }
  if (error) return dbFailure(context, error);
  if (!isAgentTokenRow(data)) return dbFailure(context, UNEXPECTED_ROW_SHAPE);
  return ok({ token: generated.raw, record: toAgentTokenRecord(data, now) });
}

/**
 * Validate and create a token. Fails with `quota` at the active-token limit
 * and `conflict` when an active token already has the name (an expired one is
 * revoked first so its name can be reused). The raw token is returned only here.
 */
export async function createAgentToken(
  admin: SupabaseClient,
  userId: string,
  input: unknown,
  now: Date
): Promise<DomainResult<CreatedAgentToken>> {
  const validated = validateTokenInput(input);
  if (!validated.ok) return validated;
  const context = failureContext(userId, "create");
  return guarded(context, async () => {
    const room = await ensureBelowActiveLimit(admin, userId, now, context);
    if (!room.ok) return room;
    const released = await releaseExpiredName(admin, userId, validated.value.name, now, context);
    if (!released.ok) return released;
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
  if (data === null) return notFound(MESSAGES.notFound);
  if (!isAgentTokenRow(data)) return dbFailure(context, UNEXPECTED_ROW_SHAPE);
  return ok(toAgentTokenRecord(data, now));
}

async function markRevoked(
  admin: SupabaseClient,
  userId: string,
  id: string,
  now: Date,
  context: FailureContext
): Promise<DomainResult<null>> {
  const { error } = await admin
    .from(TOKEN_TABLE)
    .update({ revoked_at: now.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("revoked_at", null);
  return error ? dbFailure(context, error) : ok(null);
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
  if (!isValidUUID(id)) return notFound(MESSAGES.notFound);
  const context = failureContext(userId, "revoke");
  return guarded(context, async () => {
    const revoked = await markRevoked(admin, userId, id, now, context);
    if (!revoked.ok) return revoked;
    return loadOwnRecord(admin, userId, id, now, context);
  });
}

function summarizeRevoked(
  rows: unknown,
  now: Date,
  context: FailureContext
): DomainResult<RevokeAllResult> {
  if (!isArrayOf(rows, isRevokedRow)) return dbFailure(context, UNEXPECTED_ROW_SHAPE);
  const activeRevoked = rows.filter((row) => !isExpired(row.expires_at, now)).length;
  return ok({ revoked: rows.length, activeRevoked });
}

/**
 * Revoke every unrevoked token the user has, expired ones included so they
 * release their names. See RevokeAllResult for the two counts.
 */
export async function revokeAllAgentTokens(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<DomainResult<RevokeAllResult>> {
  const context = failureContext(userId, "revokeAll");
  return guarded(context, async () => {
    const { data, error } = await admin
      .from(TOKEN_TABLE)
      .update({ revoked_at: now.toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select(REVOKED_SELECT);
    if (error) return dbFailure(context, error);
    return summarizeRevoked(data, now, context);
  });
}
