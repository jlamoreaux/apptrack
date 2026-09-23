/**
 * Wins domain service — shared by the REST routes (/api/wins) and the MCP tools.
 *
 * Every function takes the service-role admin client plus the acting user id and
 * scopes each query to that user_id, so a caller can only reach its own rows.
 * Functions never throw: Supabase errors (and thrown exceptions) are logged with
 * context and returned as a generic `db` result, so no database error text ever
 * reaches a response.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_SOURCE,
  WIN_TAGS,
  WIN_SOURCES,
  WIN_LIMITS,
  EVIDENCE_URL_MAX,
  type WinTag,
  type WinSource,
} from "@/lib/constants/careerotter";
import {
  AGENT_WRITE_QUOTAS,
  MCP_LIST_WINS,
} from "@/lib/constants/agent-access";
import { MS_PER_DAY } from "@/lib/constants/dates";
import { NO_ROWS_CODE } from "@/lib/constants/postgres";
import type { WinTagCounts } from "@/lib/careerotter/coverage";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { isValidUUID } from "@/lib/utils/api-validation";
import {
  conflict,
  dbFailure,
  findRowByExternalRef,
  guarded,
  hasControlCharacter,
  hasNulCharacter,
  invalid,
  isCalendarDate,
  isNullableString,
  isPlainObject,
  isUniqueViolationOn,
  notFound,
  ok,
  overQuota,
  parseExternalRef,
  toIsoDate,
  trackAfterResponse,
  truncateCodePoints,
  type FailureContext,
} from "@/lib/careerotter/domain-result";
import type { DomainResult } from "@/types";

/** Columns the REST API has always returned; REST responses must not grow. */
export const WIN_REST_SELECT =
  "id, text, impact_number, tag, source, created_at, edited_at";

/** REST columns plus the agent-facing provenance columns. */
export const WIN_AGENT_SELECT =
  "id, text, impact_number, tag, source, created_at, edited_at, occurred_at, evidence_url, external_ref";

export type WinSelect = typeof WIN_REST_SELECT | typeof WIN_AGENT_SELECT;

/** A wins row as returned by either select list (agent columns only with WIN_AGENT_SELECT). */
export interface WinRow {
  id: string;
  text: string;
  impact_number: string | null;
  tag: WinTag | null;
  source: WinSource;
  created_at: string;
  edited_at: string | null;
  occurred_at?: string;
  evidence_url?: string | null;
  external_ref?: string | null;
}

/** Validated fields for a new win. Agent-only fields are set only when supplied. */
export interface WinInput {
  text: string;
  impact_number: string | null;
  tag: WinTag | null;
  occurred_at?: string;
  evidence_url?: string;
  external_ref?: string;
}

/** Validated fields for an edit; undefined keeps the stored value. */
export interface WinPatch {
  text?: string;
  impact_number?: string | null;
  tag?: WinTag | null;
  occurred_at?: string;
  evidence_url?: string | null;
}

export interface ValidateWinOptions {
  allowAgentFields: boolean;
}

export type WinListSort = "created_desc" | "occurred_desc";

export interface ListWinsOptions {
  since?: string;
  until?: string;
  tag?: string;
  limit?: number;
  select?: WinSelect;
  sort?: WinListSort;
}

export interface CreateWinOptions {
  source: WinSource;
  select?: WinSelect;
  // Analytics distinct id when it differs from the user id.
  distinctId?: string;
}

export interface UpdateWinOptions {
  onlySource?: WinSource;
  select?: WinSelect;
  allowAgentFields?: boolean;
}

export interface DeleteWinOptions {
  onlySource?: WinSource;
}

export interface CreatedWin {
  win: WinRow;
  duplicate: boolean;
}

export interface ListedWins {
  wins: WinRow[];
  truncated: boolean;
}

const WIN_TABLE = "wins";
const EXTERNAL_REF_CONSTRAINT = "wins_user_external_ref_key";
const OCCURRED_AT_MIN = "1970-01-01";
const OCCURRED_AT_MAX_DAYS_AHEAD = 1;
const ALLOWED_URL_PROTOCOLS: readonly string[] = ["http:", "https:"];
const WHITESPACE_PATTERN = /\s/;
const UNTAGGED = "untagged";

const MESSAGES = {
  textRequired: "Win text is required",
  textTooLong: `Win text must be ${WIN_LIMITS.textMax} characters or fewer`,
  textNul: "Win text must not contain null characters",
  impactNotString: "impact_number must be a string",
  impactNul: "impact_number must not contain null characters",
  invalidTag: "Invalid tag",
  noEditableFields: "No editable fields provided",
  notFound: "Win not found",
  loadFailed: "Failed to load wins",
  logFailed: "Failed to log win",
  updateFailed: "Failed to update win",
  deleteFailed: "Failed to delete win",
  malformedRow: "Malformed wins row",
  refConflict: "A win with this external_ref was removed while saving; try again",
  quota: `Agents can log at most ${AGENT_WRITE_QUOTAS.winsPer24h} wins per 24 hours`,
  evidenceUrlTooLong: `evidence_url must be ${EVIDENCE_URL_MAX} characters or fewer`,
  evidenceUrlInvalid: "evidence_url must be an http or https URL",
  evidenceUrlCharacters: "evidence_url must not contain whitespace or control characters",
  evidenceUrlCredentials: "evidence_url must not include a username or password",
  limitInvalid: `limit must be an integer between 1 and ${MCP_LIST_WINS.maxLimit}`,
  occurredAtTooEarly: `occurred_at must be on or after ${OCCURRED_AT_MIN}`,
  occurredAtFuture: "occurred_at cannot be in the future",
  sinceAfterUntil: "since must be on or before until",
  dateFormat: (field: string): string => `${field} must be a date in YYYY-MM-DD format`,
} as const;

type Fields = Record<string, unknown>;
type AgentInputFields = Pick<WinInput, "occurred_at" | "evidence_url" | "external_ref">;

function failureContext(userId: string, action: string, message: string): FailureContext {
  return { userId, action, logMessage: message, publicMessage: message };
}

// ── field validation ───────────────────────────────────────────────────────

function isWinTag(value: unknown): value is WinTag {
  return WIN_TAGS.some((tag) => tag === value);
}

function isWinSource(value: unknown): value is WinSource {
  return WIN_SOURCES.some((source) => source === value);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function toFields(raw: unknown): Fields {
  return isPlainObject(raw) ? raw : {};
}

// Length stays UTF-16 units: the REST cap has always counted that way.
function parseText(raw: unknown): DomainResult<string> {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return invalid(MESSAGES.textRequired);
  if (hasNulCharacter(text)) return invalid(MESSAGES.textNul);
  if (text.length > WIN_LIMITS.textMax) return invalid(MESSAGES.textTooLong);
  return ok(text);
}

// Over-long impact numbers are truncated rather than rejected, matching the
// capture bar's long-standing behavior.
function parseImpactNumber(raw: unknown): DomainResult<string | null> {
  if (isBlank(raw)) return ok(null);
  if (typeof raw !== "string") return invalid(MESSAGES.impactNotString);
  if (hasNulCharacter(raw)) return invalid(MESSAGES.impactNul);
  return ok(truncateCodePoints(raw.trim(), WIN_LIMITS.impactNumberMax));
}

function parseTag(raw: unknown): DomainResult<WinTag | null> {
  if (isBlank(raw)) return ok(null);
  return isWinTag(raw) ? ok(raw) : invalid(MESSAGES.invalidTag);
}

function parseDateField(field: string, raw: unknown): DomainResult<string> {
  return isCalendarDate(raw) ? ok(raw) : invalid(MESSAGES.dateFormat(field));
}

// One day of slack so a user ahead of UTC can log a win dated their "today".
function parseOccurredAt(raw: unknown): DomainResult<string> {
  const date = parseDateField("occurred_at", raw);
  if (!date.ok) return date;
  if (date.value < OCCURRED_AT_MIN) return invalid(MESSAGES.occurredAtTooEarly);
  const latest = toIsoDate(new Date(Date.now() + OCCURRED_AT_MAX_DAYS_AHEAD * MS_PER_DAY));
  if (date.value > latest) return invalid(MESSAGES.occurredAtFuture);
  return date;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

// Stores the normalized href, so what is saved is exactly what the URL parser
// understood (e.g. HTTPS://Example.com becomes https://example.com/).
function parseEvidenceUrl(raw: unknown): DomainResult<string> {
  if (typeof raw !== "string") return invalid(MESSAGES.evidenceUrlInvalid);
  const value = raw.trim();
  if (value.length > EVIDENCE_URL_MAX) return invalid(MESSAGES.evidenceUrlTooLong);
  if (WHITESPACE_PATTERN.test(value) || hasControlCharacter(value)) {
    return invalid(MESSAGES.evidenceUrlCharacters);
  }
  const url = parseUrl(value);
  if (url === null || !ALLOWED_URL_PROTOCOLS.includes(url.protocol)) {
    return invalid(MESSAGES.evidenceUrlInvalid);
  }
  if (url.username || url.password) return invalid(MESSAGES.evidenceUrlCredentials);
  if (url.href.length > EVIDENCE_URL_MAX) return invalid(MESSAGES.evidenceUrlTooLong);
  return ok(url.href);
}

function parseAgentFields(fields: Fields): DomainResult<AgentInputFields> {
  const parsed: AgentInputFields = {};
  if (!isBlank(fields.occurred_at)) {
    const occurredAt = parseOccurredAt(fields.occurred_at);
    if (!occurredAt.ok) return occurredAt;
    parsed.occurred_at = occurredAt.value;
  }
  if (!isBlank(fields.evidence_url)) {
    const evidenceUrl = parseEvidenceUrl(fields.evidence_url);
    if (!evidenceUrl.ok) return evidenceUrl;
    parsed.evidence_url = evidenceUrl.value;
  }
  if (fields.external_ref !== undefined && fields.external_ref !== null) {
    const externalRef = parseExternalRef(fields.external_ref);
    if (!externalRef.ok) return externalRef;
    parsed.external_ref = externalRef.value;
  }
  return ok(parsed);
}

/**
 * Validate and normalize the fields of a new win. Agent-only fields
 * (occurred_at, evidence_url, external_ref) are ignored unless
 * `allowAgentFields` is set.
 */
export function validateWinInput(
  raw: unknown,
  { allowAgentFields }: ValidateWinOptions
): DomainResult<WinInput> {
  const fields = toFields(raw);
  const text = parseText(fields.text);
  if (!text.ok) return text;
  const impactNumber = parseImpactNumber(fields.impact_number);
  if (!impactNumber.ok) return impactNumber;
  const tag = parseTag(fields.tag);
  if (!tag.ok) return tag;

  const base: WinInput = {
    text: text.value,
    impact_number: impactNumber.value,
    tag: tag.value,
  };
  if (!allowAgentFields) return ok(base);
  const agentFields = parseAgentFields(fields);
  return agentFields.ok ? ok({ ...base, ...agentFields.value }) : agentFields;
}

function parseCoreFieldsPatch(fields: Fields): DomainResult<WinPatch> {
  const patch: WinPatch = {};
  if (fields.text !== undefined) {
    const text = parseText(fields.text);
    if (!text.ok) return text;
    patch.text = text.value;
  }
  if (fields.impact_number !== undefined) {
    const impactNumber = parseImpactNumber(fields.impact_number);
    if (!impactNumber.ok) return impactNumber;
    patch.impact_number = impactNumber.value;
  }
  if (fields.tag !== undefined) {
    const tag = parseTag(fields.tag);
    if (!tag.ok) return tag;
    patch.tag = tag.value;
  }
  return ok(patch);
}

function parseEvidenceUrlPatch(raw: unknown): DomainResult<string | null> {
  return isBlank(raw) ? ok(null) : parseEvidenceUrl(raw);
}

function parseAgentFieldsPatch(fields: Fields): DomainResult<WinPatch> {
  const patch: WinPatch = {};
  if (fields.occurred_at !== undefined) {
    const occurredAt = parseOccurredAt(fields.occurred_at);
    if (!occurredAt.ok) return occurredAt;
    patch.occurred_at = occurredAt.value;
  }
  if (fields.evidence_url !== undefined) {
    const evidenceUrl = parseEvidenceUrlPatch(fields.evidence_url);
    if (!evidenceUrl.ok) return evidenceUrl;
    patch.evidence_url = evidenceUrl.value;
  }
  return ok(patch);
}

/**
 * Validate an edit. undefined keeps a field; null or "" clears impact_number,
 * tag and (agent) evidence_url. Rejects a patch with no editable field, since it
 * would otherwise bump edited_at for an edit that never happened.
 */
export function validateWinPatch(
  raw: unknown,
  { allowAgentFields }: ValidateWinOptions
): DomainResult<WinPatch> {
  const fields = toFields(raw);
  const core = parseCoreFieldsPatch(fields);
  if (!core.ok) return core;
  const agent = allowAgentFields ? parseAgentFieldsPatch(fields) : ok<WinPatch>({});
  if (!agent.ok) return agent;

  const patch: WinPatch = { ...core.value, ...agent.value };
  const hasEditableField = Object.values(patch).some((value) => value !== undefined);
  return hasEditableField ? ok(patch) : invalid(MESSAGES.noEditableFields);
}

function isValidLimit(limit: number | undefined): boolean {
  if (limit === undefined) return true;
  return Number.isInteger(limit) && limit >= 1 && limit <= MCP_LIST_WINS.maxLimit;
}

function parseListOptions(options: ListWinsOptions): DomainResult<null> {
  for (const field of ["since", "until"] as const) {
    const value = options[field];
    if (value !== undefined && !isCalendarDate(value)) {
      return invalid(MESSAGES.dateFormat(field));
    }
  }
  const { since, until } = options;
  if (since !== undefined && until !== undefined && since > until) {
    return invalid(MESSAGES.sinceAfterUntil);
  }
  if (options.tag !== undefined && !isWinTag(options.tag)) {
    return invalid(MESSAGES.invalidTag);
  }
  if (!isValidLimit(options.limit)) return invalid(MESSAGES.limitInvalid);
  return ok(null);
}

// ── row mapping ────────────────────────────────────────────────────────────

function hasCoreWinColumns(row: Fields): boolean {
  return (
    typeof row.id === "string" &&
    typeof row.text === "string" &&
    isNullableString(row.impact_number) &&
    (row.tag === null || isWinTag(row.tag)) &&
    isWinSource(row.source) &&
    typeof row.created_at === "string" &&
    isNullableString(row.edited_at)
  );
}

function hasValidAgentColumns(row: Fields): boolean {
  if ("occurred_at" in row && typeof row.occurred_at !== "string") return false;
  if ("evidence_url" in row && !isNullableString(row.evidence_url)) return false;
  return !("external_ref" in row) || isNullableString(row.external_ref);
}

function isWinRow(row: unknown): row is WinRow {
  return isPlainObject(row) && hasCoreWinColumns(row) && hasValidAgentColumns(row);
}

/** Maps a returned row, treating a malformed one as a database fault. */
function winOrFailure(row: unknown, context: FailureContext): DomainResult<WinRow> {
  return isWinRow(row) ? ok(row) : dbFailure(context, new Error(MESSAGES.malformedRow));
}

function winsOrFailure(rows: unknown, context: FailureContext): DomainResult<WinRow[]> {
  const list: unknown[] = Array.isArray(rows) ? rows : [];
  if (!list.every(isWinRow)) return dbFailure(context, new Error(MESSAGES.malformedRow));
  return ok(list);
}

// ── create ─────────────────────────────────────────────────────────────────

async function isOverAgentQuota(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<boolean>> {
  const windowStart = new Date(Date.now() - MS_PER_DAY).toISOString();
  const { count, error } = await admin
    .from(WIN_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .eq("source", AGENT_SOURCE)
    .gte("created_at", windowStart);
  if (error) return dbFailure(context, error);
  return ok((count ?? 0) >= AGENT_WRITE_QUOTAS.winsPer24h);
}

async function findByExternalRef(
  admin: SupabaseClient,
  externalRef: string,
  select: WinSelect,
  context: FailureContext
): Promise<DomainResult<WinRow | null>> {
  const found = await findRowByExternalRef(
    admin,
    { table: WIN_TABLE, select, userId: context.userId, externalRef },
    context
  );
  if (!found.ok) return found;
  if (found.value === null) return ok(null);
  return winOrFailure(found.value, context);
}

async function existingDuplicate(
  admin: SupabaseClient,
  externalRef: string,
  select: WinSelect,
  context: FailureContext
): Promise<DomainResult<CreatedWin>> {
  const existing = await findByExternalRef(admin, externalRef, select, context);
  if (!existing.ok) return existing;
  if (existing.value === null) return conflict(MESSAGES.refConflict);
  return ok({ win: existing.value, duplicate: true });
}

async function insertWin(
  admin: SupabaseClient,
  input: WinInput,
  source: WinSource,
  select: WinSelect,
  context: FailureContext
): Promise<DomainResult<CreatedWin>> {
  const { data, error } = await admin
    .from(WIN_TABLE)
    .insert({ user_id: context.userId, ...input, source })
    .select(select)
    .single();
  if (error) {
    if (input.external_ref && isUniqueViolationOn(error, EXTERNAL_REF_CONSTRAINT)) {
      return existingDuplicate(admin, input.external_ref, select, context);
    }
    return dbFailure(context, error);
  }
  const win = winOrFailure(data, context);
  return win.ok ? ok({ win: win.value, duplicate: false }) : win;
}

/** A retried external_ref returns the stored row, even when over quota. */
async function priorWrite(
  admin: SupabaseClient,
  input: WinInput,
  select: WinSelect,
  context: FailureContext
): Promise<DomainResult<CreatedWin | null>> {
  if (!input.external_ref) return ok(null);
  const existing = await findByExternalRef(admin, input.external_ref, select, context);
  if (!existing.ok) return existing;
  return ok(existing.value === null ? null : { win: existing.value, duplicate: true });
}

async function writeWin(
  admin: SupabaseClient,
  input: WinInput,
  source: WinSource,
  select: WinSelect,
  context: FailureContext
): Promise<DomainResult<CreatedWin>> {
  const prior = await priorWrite(admin, input, select, context);
  if (!prior.ok) return prior;
  if (prior.value !== null) return ok(prior.value);
  if (source === AGENT_SOURCE) {
    const overLimit = await isOverAgentQuota(admin, context);
    if (!overLimit.ok) return overLimit;
    if (overLimit.value) return overQuota(MESSAGES.quota);
  }
  return insertWin(admin, input, source, select, context);
}

function trackWinLogged(
  context: FailureContext,
  distinctId: string,
  tag: WinTag | null,
  source: WinSource
): void {
  trackAfterResponse(context, () =>
    captureServerEvent(distinctId, CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: tag ?? UNTAGGED,
      source,
    })
  );
}

/**
 * Insert a win. With an external_ref that the user already used, returns the
 * stored row with `duplicate: true` (no analytics event), even when the agent
 * is over quota. Agent writes are subject to the rolling 24h quota.
 */
export async function createWin(
  admin: SupabaseClient,
  userId: string,
  input: WinInput,
  { source, select = WIN_REST_SELECT, distinctId }: CreateWinOptions
): Promise<DomainResult<CreatedWin>> {
  const context = failureContext(userId, "win_log_failed", MESSAGES.logFailed);
  const created = await guarded(context, () => writeWin(admin, input, source, select, context));
  if (created.ok && !created.value.duplicate) {
    trackWinLogged(context, distinctId ?? userId, input.tag, source);
  }
  return created;
}

// ── list ───────────────────────────────────────────────────────────────────

async function queryWins(
  admin: SupabaseClient,
  options: ListWinsOptions,
  context: FailureContext
): Promise<DomainResult<WinRow[]>> {
  const { since, until, tag, limit, select = WIN_REST_SELECT } = options;
  let query = admin.from(WIN_TABLE).select(select).eq("user_id", context.userId);
  if (since !== undefined) query = query.gte("occurred_at", since);
  if (until !== undefined) query = query.lte("occurred_at", until);
  if (tag !== undefined) query = query.eq("tag", tag);
  if (options.sort !== "created_desc") {
    query = query.order("occurred_at", { ascending: false });
  }
  query = query.order("created_at", { ascending: false });
  if (limit !== undefined) query = query.limit(limit + 1);

  const { data, error } = await query;
  if (error) return dbFailure(context, error);
  return winsOrFailure(data, context);
}

/**
 * List the user's wins. Date filters apply to occurred_at (inclusive). With a
 * limit, one extra row is fetched so `truncated` reports whether more exist;
 * without one the list is unbounded.
 */
export async function listWins(
  admin: SupabaseClient,
  userId: string,
  options: ListWinsOptions = {}
): Promise<DomainResult<ListedWins>> {
  const validOptions = parseListOptions(options);
  if (!validOptions.ok) return validOptions;

  const context = failureContext(userId, "wins_list_failed", MESSAGES.loadFailed);
  const rows = await guarded(context, () => queryWins(admin, options, context));
  if (!rows.ok) return rows;
  const { limit } = options;
  const truncated = limit !== undefined && rows.value.length > limit;
  return ok({ wins: truncated ? rows.value.slice(0, limit) : rows.value, truncated });
}

// ── count ──────────────────────────────────────────────────────────────────

// head: true returns only the count, so no row limit can truncate it.
async function countWins(
  admin: SupabaseClient,
  tag: WinTag | null,
  context: FailureContext
): Promise<DomainResult<number>> {
  let query = admin
    .from(WIN_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId);
  if (tag !== null) query = query.eq("tag", tag);
  const { count, error } = await query;
  if (error) return dbFailure(context, error);
  return ok(count ?? 0);
}

async function queryTagCounts(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<WinTagCounts>> {
  const [total, ...tagged] = await Promise.all([
    countWins(admin, null, context),
    ...WIN_TAGS.map((tag) => countWins(admin, tag, context)),
  ]);
  if (!total.ok) return total;
  const byTag = new Map<WinTag, number>();
  for (const [index, tag] of WIN_TAGS.entries()) {
    const count = tagged[index];
    if (!count.ok) return count;
    byTag.set(tag, count.value);
  }
  const taggedTotal = [...byTag.values()].reduce((sum, count) => sum + count, 0);
  return ok({ total: total.value, byTag, untagged: Math.max(0, total.value - taggedTotal) });
}

/**
 * Per-area win counts for the user, from count-only queries, so the result
 * covers every win however many there are.
 */
export async function countWinsByTag(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<WinTagCounts>> {
  const context = failureContext(userId, "wins_count_failed", MESSAGES.loadFailed);
  return guarded(context, () => queryTagCounts(admin, context));
}

// ── update / delete ────────────────────────────────────────────────────────

async function writeWinPatch(
  admin: SupabaseClient,
  id: string,
  patch: WinPatch,
  { onlySource, select = WIN_REST_SELECT }: UpdateWinOptions,
  context: FailureContext
): Promise<DomainResult<WinRow>> {
  let query = admin
    .from(WIN_TABLE)
    .update({ ...patch, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", context.userId);
  if (onlySource !== undefined) query = query.eq("source", onlySource);

  const { data, error } = await query.select(select).single();
  // Real DB errors are handled before the not-found branch so a genuine
  // failure isn't masked as a 404 (errors generally arrive with data: null).
  if (error) {
    return error.code === NO_ROWS_CODE
      ? notFound(MESSAGES.notFound)
      : dbFailure(context, error);
  }
  if (!data) return notFound(MESSAGES.notFound);
  return winOrFailure(data, context);
}

/**
 * Edit one of the user's wins and set edited_at. With `onlySource`, rows from
 * any other source are reported as not found.
 */
export async function updateWin(
  admin: SupabaseClient,
  userId: string,
  id: string,
  rawPatch: unknown,
  options: UpdateWinOptions = {}
): Promise<DomainResult<WinRow>> {
  if (!isValidUUID(id)) return notFound(MESSAGES.notFound);
  const allowAgentFields = options.allowAgentFields ?? false;
  const patch = validateWinPatch(rawPatch, { allowAgentFields });
  if (!patch.ok) return patch;

  const context = failureContext(userId, "win_update_failed", MESSAGES.updateFailed);
  return guarded(context, () => writeWinPatch(admin, id, patch.value, options, context));
}

async function removeWin(
  admin: SupabaseClient,
  id: string,
  { onlySource }: DeleteWinOptions,
  context: FailureContext
): Promise<DomainResult<{ id: string }>> {
  let query = admin
    .from(WIN_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", context.userId);
  if (onlySource !== undefined) query = query.eq("source", onlySource);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) return dbFailure(context, error);
  if (!data) return notFound(MESSAGES.notFound);
  return ok({ id });
}

/** Delete one of the user's wins; `onlySource` restricts which rows qualify. */
export async function deleteWin(
  admin: SupabaseClient,
  userId: string,
  id: string,
  options: DeleteWinOptions = {}
): Promise<DomainResult<{ id: string }>> {
  if (!isValidUUID(id)) return notFound(MESSAGES.notFound);
  const context = failureContext(userId, "win_delete_failed", MESSAGES.deleteFailed);
  return guarded(context, () => removeWin(admin, id, options, context));
}
