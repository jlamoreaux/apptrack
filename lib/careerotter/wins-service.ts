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
import { after } from "next/server";
import {
  WIN_TAGS,
  WIN_LIMITS,
  EXTERNAL_REF_MAX,
  EVIDENCE_URL_MAX,
  type WinTag,
  type WinSource,
} from "@/lib/constants/careerotter";
import {
  AGENT_WRITE_QUOTAS,
  MCP_LIST_WINS,
} from "@/lib/constants/agent-access";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { isValidUUID } from "@/lib/utils/api-validation";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
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

const WIN_TABLE = "wins";
const EXTERNAL_REF_CONSTRAINT = "wins_user_external_ref_key";
const UNIQUE_VIOLATION_CODE = "23505";
const NO_ROWS_CODE = "PGRST116";
const OCCURRED_AT_MIN = "1970-01-01";
const OCCURRED_AT_MAX_DAYS_AHEAD = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;
const ALLOWED_URL_PROTOCOLS: readonly string[] = ["http:", "https:"];

const MESSAGES = {
  textRequired: "Win text is required",
  textTooLong: `Win text must be ${WIN_LIMITS.textMax} characters or fewer`,
  impactNotString: "impact_number must be a string",
  invalidTag: "Invalid tag",
  noEditableFields: "No editable fields provided",
  notFound: "Win not found",
  loadFailed: "Failed to load wins",
  logFailed: "Failed to log win",
  updateFailed: "Failed to update win",
  deleteFailed: "Failed to delete win",
  refConflict: "A win with this external_ref was removed while saving; try again",
  quota: `Agents can log at most ${AGENT_WRITE_QUOTAS.winsPer24h} wins per 24 hours`,
  evidenceUrlTooLong: `evidence_url must be ${EVIDENCE_URL_MAX} characters or fewer`,
  evidenceUrlInvalid: "evidence_url must be an http or https URL",
  externalRefInvalid: `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`,
  limitInvalid: `limit must be an integer between 1 and ${MCP_LIST_WINS.maxLimit}`,
} as const;

interface FailureContext {
  userId: string;
  action: string;
  logMessage: string;
  publicMessage: string;
}

type Fields = Record<string, unknown>;

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

// ── field validation ───────────────────────────────────────────────────────

function isWinTag(value: unknown): value is WinTag {
  return WIN_TAGS.some((tag) => tag === value);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function toFields(raw: unknown): Fields {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(Object.entries(raw));
}

function parseText(raw: unknown): DomainResult<string> {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return invalid(MESSAGES.textRequired);
  if (text.length > WIN_LIMITS.textMax) return invalid(MESSAGES.textTooLong);
  return ok(text);
}

// Over-long impact numbers are truncated rather than rejected, matching the
// capture bar's long-standing behavior.
function parseImpactNumber(raw: unknown): DomainResult<string | null> {
  if (isBlank(raw)) return ok(null);
  if (typeof raw !== "string") return invalid(MESSAGES.impactNotString);
  return ok(raw.trim().slice(0, WIN_LIMITS.impactNumberMax));
}

function parseTag(raw: unknown): DomainResult<WinTag | null> {
  if (isBlank(raw)) return ok(null);
  return isWinTag(raw) ? ok(raw) : invalid(MESSAGES.invalidTag);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** True for a YYYY-MM-DD string naming a real calendar date. */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

function parseDateField(field: string, raw: unknown): DomainResult<string> {
  return isCalendarDate(raw)
    ? ok(raw)
    : invalid(`${field} must be a date in YYYY-MM-DD format`);
}

// One day of slack so a user ahead of UTC can log a win dated their "today".
function parseOccurredAt(raw: unknown): DomainResult<string> {
  const date = parseDateField("occurred_at", raw);
  if (!date.ok) return date;
  if (date.value < OCCURRED_AT_MIN) {
    return invalid(`occurred_at must be on or after ${OCCURRED_AT_MIN}`);
  }
  const latest = toIsoDate(
    new Date(Date.now() + OCCURRED_AT_MAX_DAYS_AHEAD * MS_PER_DAY)
  );
  if (date.value > latest) return invalid("occurred_at cannot be in the future");
  return date;
}

function hasAllowedProtocol(value: string): boolean {
  try {
    return ALLOWED_URL_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function parseEvidenceUrl(raw: unknown): DomainResult<string> {
  if (typeof raw !== "string") return invalid(MESSAGES.evidenceUrlInvalid);
  const url = raw.trim();
  if (url.length > EVIDENCE_URL_MAX) return invalid(MESSAGES.evidenceUrlTooLong);
  return hasAllowedProtocol(url) ? ok(url) : invalid(MESSAGES.evidenceUrlInvalid);
}

function parseExternalRef(raw: unknown): DomainResult<string> {
  const ref = typeof raw === "string" ? raw.trim() : "";
  if (!ref || ref.length > EXTERNAL_REF_MAX) {
    return invalid(MESSAGES.externalRefInvalid);
  }
  return ok(ref);
}

function parseAgentFields(
  fields: Fields
): DomainResult<Pick<WinInput, "occurred_at" | "evidence_url" | "external_ref">> {
  const parsed: Pick<WinInput, "occurred_at" | "evidence_url" | "external_ref"> = {};
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

function parseAgentFieldsPatch(fields: Fields): DomainResult<WinPatch> {
  const patch: WinPatch = {};
  if (fields.occurred_at !== undefined) {
    const occurredAt = parseOccurredAt(fields.occurred_at);
    if (!occurredAt.ok) return occurredAt;
    patch.occurred_at = occurredAt.value;
  }
  if (fields.evidence_url !== undefined) {
    if (isBlank(fields.evidence_url)) {
      patch.evidence_url = null;
    } else {
      const evidenceUrl = parseEvidenceUrl(fields.evidence_url);
      if (!evidenceUrl.ok) return evidenceUrl;
      patch.evidence_url = evidenceUrl.value;
    }
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

function parseListOptions(options: ListWinsOptions): DomainResult<null> {
  if (options.since !== undefined) {
    const since = parseDateField("since", options.since);
    if (!since.ok) return since;
  }
  if (options.until !== undefined) {
    const until = parseDateField("until", options.until);
    if (!until.ok) return until;
  }
  if (options.tag !== undefined && !isWinTag(options.tag)) {
    return invalid(MESSAGES.invalidTag);
  }
  const { limit } = options;
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || limit < 1 || limit > MCP_LIST_WINS.maxLimit)
  ) {
    return invalid(MESSAGES.limitInvalid);
  }
  return ok(null);
}

// ── create ─────────────────────────────────────────────────────────────────

interface PostgrestErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function isExternalRefConflict(error: PostgrestErrorLike): boolean {
  if (error.code !== UNIQUE_VIOLATION_CODE) return false;
  return [error.message, error.details].some(
    (text) => typeof text === "string" && text.includes(EXTERNAL_REF_CONSTRAINT)
  );
}

async function isOverAgentQuota(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<boolean>> {
  const windowStart = new Date(Date.now() - MS_PER_DAY).toISOString();
  const { count, error } = await admin
    .from(WIN_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .eq("source", "agent")
    .gte("created_at", windowStart);
  if (error) return dbFailure(context, error);
  return ok((count ?? 0) >= AGENT_WRITE_QUOTAS.winsPer24h);
}

async function findByExternalRef(
  admin: SupabaseClient,
  externalRef: string,
  select: WinSelect,
  context: FailureContext
): Promise<DomainResult<{ win: WinRow; duplicate: boolean }>> {
  const { data, error } = await admin
    .from(WIN_TABLE)
    .select<WinSelect, WinRow>(select)
    .eq("user_id", context.userId)
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error) return dbFailure(context, error);
  if (!data) return { ok: false, kind: "conflict", message: MESSAGES.refConflict };
  return ok({ win: data, duplicate: true });
}

function trackWinLogged(
  distinctId: string,
  tag: WinTag | null,
  source: WinSource
): void {
  after(
    captureServerEvent(distinctId, CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: tag ?? "untagged",
      source,
    })
  );
}

/**
 * Insert a win. With an external_ref that the user already used, returns the
 * stored row with `duplicate: true` (no analytics event). Agent writes are
 * subject to the rolling 24h quota.
 */
export async function createWin(
  admin: SupabaseClient,
  userId: string,
  input: WinInput,
  { source, select = WIN_REST_SELECT, distinctId }: CreateWinOptions
): Promise<DomainResult<{ win: WinRow; duplicate: boolean }>> {
  const context: FailureContext = {
    userId,
    action: "win_log_failed",
    logMessage: "Failed to log win",
    publicMessage: MESSAGES.logFailed,
  };
  return guarded(context, async () => {
    if (source === "agent") {
      const overQuota = await isOverAgentQuota(admin, context);
      if (!overQuota.ok) return overQuota;
      if (overQuota.value) {
        return { ok: false, kind: "quota", message: MESSAGES.quota };
      }
    }

    const { data, error } = await admin
      .from(WIN_TABLE)
      .insert({ user_id: userId, ...input, source })
      .select<WinSelect, WinRow>(select)
      .single();

    if (error) {
      if (input.external_ref && isExternalRefConflict(error)) {
        return findByExternalRef(admin, input.external_ref, select, context);
      }
      return dbFailure(context, error);
    }

    trackWinLogged(distinctId ?? userId, input.tag, source);
    return ok({ win: data, duplicate: false });
  });
}

// ── list ───────────────────────────────────────────────────────────────────

/**
 * List the user's wins. Date filters apply to occurred_at (inclusive). With a
 * limit, one extra row is fetched so `truncated` reports whether more exist;
 * without one the list is unbounded.
 */
export async function listWins(
  admin: SupabaseClient,
  userId: string,
  options: ListWinsOptions = {}
): Promise<DomainResult<{ wins: WinRow[]; truncated: boolean }>> {
  const validOptions = parseListOptions(options);
  if (!validOptions.ok) return validOptions;

  const context: FailureContext = {
    userId,
    action: "wins_list_failed",
    logMessage: "Failed to list wins",
    publicMessage: MESSAGES.loadFailed,
  };
  return guarded(context, async () => {
    const { since, until, tag, limit, select = WIN_REST_SELECT } = options;
    let query = admin.from(WIN_TABLE).select<WinSelect, WinRow>(select).eq("user_id", userId);
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

    const rows = data ?? [];
    const truncated = limit !== undefined && rows.length > limit;
    return ok({ wins: truncated ? rows.slice(0, limit) : rows, truncated });
  });
}

// ── update / delete ────────────────────────────────────────────────────────

/**
 * Edit one of the user's wins and set edited_at. With `onlySource`, rows from
 * any other source are reported as not found.
 */
export async function updateWin(
  admin: SupabaseClient,
  userId: string,
  id: string,
  rawPatch: unknown,
  { onlySource, select = WIN_REST_SELECT, allowAgentFields = false }: UpdateWinOptions = {}
): Promise<DomainResult<WinRow>> {
  if (!isValidUUID(id)) return notFound();
  const patch = validateWinPatch(rawPatch, { allowAgentFields });
  if (!patch.ok) return patch;

  const context: FailureContext = {
    userId,
    action: "win_update_failed",
    logMessage: "Failed to update win",
    publicMessage: MESSAGES.updateFailed,
  };
  return guarded(context, async () => {
    let query = admin
      .from(WIN_TABLE)
      .update({ ...patch.value, edited_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (onlySource !== undefined) query = query.eq("source", onlySource);

    const { data, error } = await query.select<WinSelect, WinRow>(select).single();
    // Real DB errors are handled before the not-found branch so a genuine
    // failure isn't masked as a 404 (errors generally arrive with data: null).
    if (error) {
      return error.code === NO_ROWS_CODE ? notFound() : dbFailure(context, error);
    }
    if (!data) return notFound();
    return ok(data);
  });
}

/** Delete one of the user's wins; `onlySource` restricts which rows qualify. */
export async function deleteWin(
  admin: SupabaseClient,
  userId: string,
  id: string,
  { onlySource }: DeleteWinOptions = {}
): Promise<DomainResult<{ id: string }>> {
  if (!isValidUUID(id)) return notFound();

  const context: FailureContext = {
    userId,
    action: "win_delete_failed",
    logMessage: "Failed to delete win",
    publicMessage: MESSAGES.deleteFailed,
  };
  return guarded(context, async () => {
    let query = admin
      .from(WIN_TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (onlySource !== undefined) query = query.eq("source", onlySource);

    const { data, error } = await query.select("id").maybeSingle();
    if (error) return dbFailure(context, error);
    if (!data) return notFound();
    const deletedId: string = data.id;
    return ok({ id: deletedId });
  });
}
