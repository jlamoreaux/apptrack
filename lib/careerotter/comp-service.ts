/**
 * Comp domain service — shared by the REST routes (/api/careerotter/comp) and
 * the MCP tools.
 *
 * Every function takes the service-role admin client plus the acting user id and
 * scopes each query to that user_id, so a caller can only reach its own rows.
 * Functions never throw: Supabase errors (and thrown exceptions) are logged with
 * context and returned as a generic `db` result, so no database error text ever
 * reaches a response.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompEntry } from "@/lib/careerotter/comp-projection";
import {
  checkCliffFitsVest,
  COMP_ENTRY_MESSAGES,
  parseAmount,
  parseEffectiveDate,
  parseNote,
  parseShares,
  parseTicker,
  parseVestCliff,
  parseVestStart,
  parseVestYears,
  validateCompEntryInput,
  type FieldResult,
} from "@/lib/careerotter/comp-entry-validation";
import { AGENT_SOURCE, COMP_SOURCES, type CompSource } from "@/lib/constants/careerotter";
import { AGENT_WRITE_QUOTAS } from "@/lib/constants/agent-access";
import { MS_PER_DAY } from "@/lib/constants/dates";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { isValidUUID } from "@/lib/utils/api-validation";
import {
  conflict,
  dbFailure,
  findRowByExternalRef,
  guarded,
  invalid,
  isCalendarDate,
  isPlainObject,
  isUniqueViolationOn,
  notFound,
  ok,
  overQuota,
  parseExternalRef,
  trackAfterResponse,
  type FailureContext,
} from "@/lib/careerotter/domain-result";
import type { DomainResult } from "@/types";

const COMP_TABLE = "comp_entries";
const EXTERNAL_REF_CONSTRAINT = "comp_entries_user_external_ref_key";
const COMP_SERVICE_SELECT =
  "id, effective_date, base, bonus, equity, currency, note, ticker, shares, vest_start, vest_years, vest_cliff_months, source, external_ref, updated_at, created_at";

// Field rules and their messages live in comp-entry-validation.ts, shared
// with the entry form and the guest cache; these are the service's own.
const MESSAGES = {
  patchNotObject: "Comp entry changes must be a JSON object",
  note: "note must be a string",
  immutable: "external_ref and source cannot be changed",
  notFound: "Comp entry not found",
  refConflict: "A comp entry with this external_ref was removed while saving; try again",
  staleWrite: "This comp entry changed while saving; try again",
  agentQuota: `Agents can add at most ${AGENT_WRITE_QUOTAS.compEntriesPer24h} comp entries per 24 hours`,
  totalCap: `You can keep at most ${AGENT_WRITE_QUOTAS.compEntriesTotal} comp entries`,
  loadFailed: "Failed to load comp entries",
  saveFailed: "Failed to save comp entry",
  saveFailedLog: "Failed to add comp entry",
  updateFailed: "Failed to update comp entry",
  deleteFailed: "Failed to delete comp entry",
  malformedRow: "Malformed comp_entries row",
} as const;

export const COMP_FIELD_NAMES = [
  "effective_date",
  "base",
  "bonus",
  "equity",
  "note",
  "ticker",
  "shares",
  "vest_start",
  "vest_years",
  "vest_cliff_months",
] as const;
export type CompFieldName = (typeof COMP_FIELD_NAMES)[number];

/** Unvalidated comp fields as a caller supplies them. */
export type CompFieldsInput = Partial<Record<CompFieldName, unknown>>;

/** Unvalidated create input; external_ref is the agent's idempotency key. */
export interface CompInput extends CompFieldsInput {
  external_ref?: unknown;
}

/** Unvalidated edit: undefined keeps the stored value, null clears it. */
export interface CompPatch extends CompFieldsInput {
  external_ref?: unknown;
  source?: unknown;
}

/** The user-editable columns of a comp entry, validated. */
export type CompFields = Pick<CompEntry, CompFieldName>;

export interface ValidCompInput extends CompFields {
  external_ref: string | null;
}

/** A comp_entries row with the provenance columns service consumers need. */
export interface StoredCompEntry extends CompEntry {
  source: CompSource;
  external_ref: string | null;
  updated_at: string | null;
  created_at: string;
}

export interface CreateCompOptions {
  source: CompSource;
}

export interface CompWriteScope {
  onlySource?: CompSource;
}

export interface CreatedCompEntry {
  entry: StoredCompEntry;
  duplicate: boolean;
}

export interface CurrentCompEntries<T> {
  current: T | null;
  upcoming: T | null;
}

type FieldParser<K extends CompFieldName> = (raw: unknown) => DomainResult<CompFields[K]>;
type AmountFields = Pick<CompFields, "base" | "bonus" | "equity">;

function failureContext(
  userId: string,
  action: string,
  publicMessage: string,
  logMessage: string = publicMessage
): FailureContext {
  return { userId, action, logMessage, publicMessage };
}

// ── field validation ───────────────────────────────────────────────────────

function fromField<T>(result: FieldResult<T>): DomainResult<T> {
  return result.ok ? ok(result.value) : invalid(result.error);
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

// The shared validator is the single source of field rules, so the form, the
// guest cache, REST and MCP all accept exactly the same entries.
function validateCompFields(input: CompFieldsInput): DomainResult<CompFields> {
  const checked = validateCompEntryInput(input);
  if (!checked.ok) return invalid(checked.error);
  return ok({ ...checked.value, note: checked.note });
}

function parseOptionalExternalRef(raw: unknown): DomainResult<string | null> {
  return isPresent(raw) ? parseExternalRef(raw) : ok(null);
}

/**
 * Validates and normalizes a new comp entry with the shared validator
 * (validateCompEntryInput), then the agent's optional external_ref.
 */
export function validateCompInput(input: CompInput): DomainResult<ValidCompInput> {
  const fields = validateCompFields(input);
  if (!fields.ok) return fields;
  const externalRef = parseOptionalExternalRef(input.external_ref);
  if (!externalRef.ok) return externalRef;
  return ok({ ...fields.value, external_ref: externalRef.value });
}

// ── patch validation ───────────────────────────────────────────────────────

// Update parsers take a present value: null clears (where a field can be
// cleared) and anything else must already be valid, with none of the
// create-time coercions.
function strict<T>(parse: (raw: unknown) => FieldResult<T>): (raw: unknown) => DomainResult<T> {
  return (raw) => fromField(parse(raw));
}

function clearable<T, C>(
  parse: (raw: unknown) => DomainResult<T>,
  cleared: C
): (raw: unknown) => DomainResult<T | C> {
  return (raw: unknown): DomainResult<T | C> => (raw === null ? ok(cleared) : parse(raw));
}

function strictText(
  parse: (value: string) => FieldResult<string | null>,
  message: string
): (raw: unknown) => DomainResult<string | null> {
  return (raw) => (typeof raw === "string" ? fromField(parse(raw)) : invalid(message));
}

const PATCH_PARSERS: { [K in CompFieldName]: FieldParser<K> } = {
  effective_date: strict(parseEffectiveDate),
  base: strict((raw) => parseAmount("base", raw)),
  bonus: clearable(strict((raw) => parseAmount("bonus", raw)), 0),
  equity: clearable(strict((raw) => parseAmount("equity", raw)), 0),
  note: clearable(strictText((value) => parseNote(value, false), MESSAGES.note), null),
  ticker: clearable(strictText(parseTicker, COMP_ENTRY_MESSAGES.ticker), null),
  shares: clearable(strict(parseShares), null),
  // An empty vest_start clears it, as it reads as "not provided" on create.
  vest_start: (raw) => (raw === "" ? ok(null) : clearable(strict(parseVestStart), null)(raw)),
  vest_years: clearable(strict(parseVestYears), null),
  vest_cliff_months: clearable(strict(parseVestCliff), null),
};

function applyPatchField<K extends CompFieldName>(
  target: Partial<CompFields>,
  name: K,
  raw: unknown
): DomainResult<null> {
  const parsed = PATCH_PARSERS[name](raw);
  if (!parsed.ok) return parsed;
  target[name] = parsed.value;
  return ok(null);
}

function parsePatch(patch: Record<string, unknown>): DomainResult<Partial<CompFields>> {
  const parsed: Partial<CompFields> = {};
  for (const name of COMP_FIELD_NAMES) {
    if (patch[name] === undefined) continue;
    const applied = applyPatchField(parsed, name, patch[name]);
    if (!applied.ok) return applied;
  }
  return ok(parsed);
}

function validatePatchShape(patch: unknown): DomainResult<Partial<CompFields>> {
  if (!isPlainObject(patch)) return invalid(MESSAGES.patchNotObject);
  if (patch.external_ref !== undefined || patch.source !== undefined) {
    return invalid(MESSAGES.immutable);
  }
  return parsePatch(patch);
}

function mergePatch(
  existing: StoredCompEntry,
  patch: Partial<CompFields>
): DomainResult<CompFields> {
  const merged: CompFields = { ...toCompFields(existing), ...patch };
  const fits = checkCliffFitsVest(merged.vest_cliff_months, merged.vest_years);
  return fits.ok ? ok(merged) : invalid(fits.error);
}

// ── row mapping ────────────────────────────────────────────────────────────

function isCompSource(value: unknown): value is CompSource {
  return COMP_SOURCES.some((source) => source === value);
}

// numeric columns may arrive as numbers or numeric strings depending on the driver.
function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readAmounts(row: Record<string, unknown>): AmountFields | null {
  const base = numberOrNull(row.base);
  const bonus = numberOrNull(row.bonus);
  const equity = numberOrNull(row.equity);
  if (base === null || bonus === null || equity === null) return null;
  return { base, bonus, equity };
}

type NullableColumns = Pick<
  StoredCompEntry,
  | "note"
  | "ticker"
  | "shares"
  | "vest_start"
  | "vest_years"
  | "vest_cliff_months"
  | "external_ref"
  | "updated_at"
>;

function readNullableColumns(row: Record<string, unknown>): NullableColumns {
  return {
    note: stringOrNull(row.note),
    ticker: stringOrNull(row.ticker),
    shares: numberOrNull(row.shares),
    vest_start: stringOrNull(row.vest_start),
    vest_years: numberOrNull(row.vest_years),
    vest_cliff_months: numberOrNull(row.vest_cliff_months),
    external_ref: stringOrNull(row.external_ref),
    updated_at: stringOrNull(row.updated_at),
  };
}

function toStoredCompEntry(row: unknown): StoredCompEntry | null {
  if (!isPlainObject(row)) return null;
  const { id, effective_date, currency, created_at, source } = row;
  const amounts = readAmounts(row);
  if (typeof id !== "string" || typeof effective_date !== "string") return null;
  if (typeof currency !== "string" || typeof created_at !== "string") return null;
  if (!isCompSource(source) || amounts === null) return null;
  return {
    id,
    effective_date,
    ...amounts,
    currency,
    ...readNullableColumns(row),
    source,
    created_at,
  };
}

function toCompFields(entry: CompEntry): CompFields {
  return {
    effective_date: entry.effective_date,
    base: entry.base,
    bonus: entry.bonus,
    equity: entry.equity,
    note: entry.note,
    ticker: entry.ticker,
    shares: entry.shares,
    vest_start: entry.vest_start,
    vest_years: entry.vest_years,
    vest_cliff_months: entry.vest_cliff_months,
  };
}

/** The fields the REST API has always returned for a comp entry. */
export function toCompEntry(entry: StoredCompEntry): CompEntry {
  return { id: entry.id, ...toCompFields(entry), currency: entry.currency };
}

/** Maps a single returned row, treating a malformed row as a database fault. */
function storedOrFailure(
  row: unknown,
  context: FailureContext
): DomainResult<StoredCompEntry> {
  const entry = toStoredCompEntry(row);
  if (entry === null) return dbFailure(context, new Error(MESSAGES.malformedRow));
  return ok(entry);
}

function storedListOrFailure(
  rows: unknown,
  context: FailureContext
): DomainResult<StoredCompEntry[]> {
  const entries: StoredCompEntry[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const entry = storedOrFailure(row, context);
    if (!entry.ok) return entry;
    entries.push(entry.value);
  }
  return ok(entries);
}

// ── reads ──────────────────────────────────────────────────────────────────

async function queryEntries(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry[]>> {
  const { data, error } = await admin
    .from(COMP_TABLE)
    .select(COMP_SERVICE_SELECT)
    .eq("user_id", context.userId)
    .order("effective_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return dbFailure(context, error);
  return storedListOrFailure(data, context);
}

/** All of the user's comp entries, oldest effective date first. */
export async function listCompEntries(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<StoredCompEntry[]>> {
  const context = failureContext(userId, "comp_entries_list_failed", MESSAGES.loadFailed);
  return guarded(context, () => queryEntries(admin, context));
}

interface DatedEntry {
  effective_date: string;
  created_at: string;
}

// created_at values are ISO timestamps from one column, so string order is
// time order, down to the microseconds Date.parse would drop.
function createdLater(candidate: DatedEntry, other: DatedEntry): boolean {
  return candidate.created_at > other.created_at;
}

function replacesCurrent(candidate: DatedEntry, current: DatedEntry | null): boolean {
  if (current === null || candidate.effective_date > current.effective_date) return true;
  return candidate.effective_date === current.effective_date && createdLater(candidate, current);
}

function replacesUpcoming(candidate: DatedEntry, upcoming: DatedEntry | null): boolean {
  if (upcoming === null || candidate.effective_date < upcoming.effective_date) return true;
  return candidate.effective_date === upcoming.effective_date && createdLater(candidate, upcoming);
}

/**
 * The package in effect on `asOf` (a YYYY-MM-DD date; the latest
 * effective_date on or before it) and the earliest future-dated one, e.g. an
 * accepted offer that has not started yet. Effective-date ties go to the most
 * recently created entry for both. An invalid `asOf` matches nothing.
 */
export function currentCompEntry<T extends DatedEntry>(
  entries: readonly T[],
  asOf: string
): CurrentCompEntries<T> {
  const picked: CurrentCompEntries<T> = { current: null, upcoming: null };
  if (!isCalendarDate(asOf)) return picked;
  for (const entry of entries) {
    if (entry.effective_date <= asOf) {
      if (replacesCurrent(entry, picked.current)) picked.current = entry;
    } else if (replacesUpcoming(entry, picked.upcoming)) {
      picked.upcoming = entry;
    }
  }
  return picked;
}

// ── create ─────────────────────────────────────────────────────────────────

async function countEntries(
  admin: SupabaseClient,
  userId: string,
  agentSince: string | null
): Promise<{ count: number; error: unknown }> {
  let query = admin
    .from(COMP_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (agentSince !== null) {
    query = query.eq("source", AGENT_SOURCE).gte("created_at", agentSince);
  }
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

async function checkAgentQuota(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<null>> {
  const since = new Date(Date.now() - MS_PER_DAY).toISOString();
  const recent = await countEntries(admin, context.userId, since);
  if (recent.error) return dbFailure(context, recent.error);
  if (recent.count >= AGENT_WRITE_QUOTAS.compEntriesPer24h) {
    return overQuota(MESSAGES.agentQuota);
  }
  return ok(null);
}

async function checkQuota(
  admin: SupabaseClient,
  source: CompSource,
  context: FailureContext
): Promise<DomainResult<null>> {
  if (source === AGENT_SOURCE) {
    const agent = await checkAgentQuota(admin, context);
    if (!agent.ok) return agent;
  }
  const total = await countEntries(admin, context.userId, null);
  if (total.error) return dbFailure(context, total.error);
  if (total.count >= AGENT_WRITE_QUOTAS.compEntriesTotal) {
    return overQuota(MESSAGES.totalCap);
  }
  return ok(null);
}

async function existingDuplicate(
  admin: SupabaseClient,
  externalRef: string,
  context: FailureContext
): Promise<DomainResult<CreatedCompEntry>> {
  const found = await findRowByExternalRef(
    admin,
    { table: COMP_TABLE, select: COMP_SERVICE_SELECT, userId: context.userId, externalRef },
    context
  );
  if (!found.ok) return found;
  if (found.value === null) return conflict(MESSAGES.refConflict);
  const entry = storedOrFailure(found.value, context);
  return entry.ok ? ok({ entry: entry.value, duplicate: true }) : entry;
}

async function insertCompEntry(
  admin: SupabaseClient,
  input: ValidCompInput,
  source: CompSource,
  context: FailureContext
): Promise<DomainResult<CreatedCompEntry>> {
  const { data, error } = await admin
    .from(COMP_TABLE)
    .insert({ user_id: context.userId, ...input, source })
    .select(COMP_SERVICE_SELECT)
    .single();
  if (error) {
    if (input.external_ref !== null && isUniqueViolationOn(error, EXTERNAL_REF_CONSTRAINT)) {
      return existingDuplicate(admin, input.external_ref, context);
    }
    return dbFailure(context, error);
  }
  const entry = storedOrFailure(data, context);
  return entry.ok ? ok({ entry: entry.value, duplicate: false }) : entry;
}

async function writeCompEntry(
  admin: SupabaseClient,
  input: ValidCompInput,
  source: CompSource,
  context: FailureContext
): Promise<DomainResult<CreatedCompEntry>> {
  const quota = await checkQuota(admin, source, context);
  if (quota.ok) return insertCompEntry(admin, input, source, context);
  // A retry of a write that already landed must stay idempotent even when
  // that write was the one that filled the quota.
  if (quota.kind !== "quota" || input.external_ref === null) return quota;
  const existing = await existingDuplicate(admin, input.external_ref, context);
  return existing.ok ? existing : quota;
}

function trackCompEntered(
  context: FailureContext,
  entry: StoredCompEntry,
  source: CompSource
): void {
  // The agent path deliberately sends no amount: a salary figure should not
  // leave the app because an agent wrote it.
  const properties =
    source === AGENT_SOURCE
      ? { source }
      : { total: entry.base + entry.bonus + entry.equity };
  trackAfterResponse(context, () =>
    captureServerEvent(context.userId, CAREEROTTER_EVENT_NAMES.COMP_ENTERED, properties)
  );
}

/**
 * Adds a comp entry. Re-submitting an external_ref the user already has returns
 * the stored row with `duplicate: true` instead of inserting (and fires no
 * analytics event).
 */
export async function createCompEntry(
  admin: SupabaseClient,
  userId: string,
  input: CompInput,
  options: CreateCompOptions
): Promise<DomainResult<CreatedCompEntry>> {
  const valid = validateCompInput(input);
  if (!valid.ok) return valid;
  const context = failureContext(
    userId,
    "comp_entry_failed",
    MESSAGES.saveFailed,
    MESSAGES.saveFailedLog
  );
  const created = await guarded(context, () =>
    writeCompEntry(admin, valid.value, options.source, context)
  );
  if (created.ok && !created.value.duplicate) {
    trackCompEntered(context, created.value.entry, options.source);
  }
  return created;
}

// ── update ─────────────────────────────────────────────────────────────────

async function loadScopedEntry(
  admin: SupabaseClient,
  id: string,
  scope: CompWriteScope,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry>> {
  let query = admin
    .from(COMP_TABLE)
    .select(COMP_SERVICE_SELECT)
    .eq("id", id)
    .eq("user_id", context.userId);
  if (scope.onlySource) query = query.eq("source", scope.onlySource);
  const { data, error } = await query.maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return notFound(MESSAGES.notFound);
  return storedOrFailure(data, context);
}

// Conditioned on the updated_at that was read, so a concurrent edit between
// the read and this write is reported instead of silently overwritten.
async function writeUpdate(
  admin: SupabaseClient,
  existing: StoredCompEntry,
  fields: CompFields,
  scope: CompWriteScope,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry>> {
  let query = admin
    .from(COMP_TABLE)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("user_id", context.userId);
  if (scope.onlySource) query = query.eq("source", scope.onlySource);
  query =
    existing.updated_at === null
      ? query.is("updated_at", null)
      : query.eq("updated_at", existing.updated_at);
  const { data, error } = await query.select(COMP_SERVICE_SELECT).maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return conflict(MESSAGES.staleWrite);
  return storedOrFailure(data, context);
}

async function applyUpdate(
  admin: SupabaseClient,
  id: string,
  patch: Partial<CompFields>,
  scope: CompWriteScope,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry>> {
  const existing = await loadScopedEntry(admin, id, scope, context);
  if (!existing.ok) return existing;
  const fields = mergePatch(existing.value, patch);
  if (!fields.ok) return fields;
  return writeUpdate(admin, existing.value, fields.value, scope, context);
}

/**
 * Edits a comp entry. undefined keeps a field and null clears it (bonus and
 * equity to 0; base and effective_date cannot be cleared); any other value
 * must be valid as given. The merged row's vest schedule is re-checked, so
 * e.g. clearing vest_years while a cliff is set fails. With `onlySource`, rows
 * from any other source are reported as not found. A concurrent edit is a
 * `conflict`.
 */
export async function updateCompEntry(
  admin: SupabaseClient,
  userId: string,
  id: string,
  patch: unknown,
  scope: CompWriteScope = {}
): Promise<DomainResult<StoredCompEntry>> {
  if (!isValidUUID(id)) return notFound(MESSAGES.notFound);
  const parsed = validatePatchShape(patch);
  if (!parsed.ok) return parsed;
  const context = failureContext(userId, "comp_entry_update_failed", MESSAGES.updateFailed);
  return guarded(context, () => applyUpdate(admin, id, parsed.value, scope, context));
}

// ── delete ─────────────────────────────────────────────────────────────────

async function removeCompEntry(
  admin: SupabaseClient,
  id: string,
  scope: CompWriteScope,
  context: FailureContext
): Promise<DomainResult<{ id: string }>> {
  let query = admin.from(COMP_TABLE).delete().eq("id", id).eq("user_id", context.userId);
  if (scope.onlySource) query = query.eq("source", scope.onlySource);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return notFound(MESSAGES.notFound);
  return ok({ id });
}

/** Deletes a comp entry; a missing row (or one outside `onlySource`) is not_found. */
export async function deleteCompEntry(
  admin: SupabaseClient,
  userId: string,
  id: string,
  scope: CompWriteScope = {}
): Promise<DomainResult<{ id: string }>> {
  if (!isValidUUID(id)) return notFound(MESSAGES.notFound);
  const context = failureContext(userId, "comp_entry_delete_failed", MESSAGES.deleteFailed);
  return guarded(context, () => removeCompEntry(admin, id, scope, context));
}
