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
import { after } from "next/server";
import type { CompEntry } from "@/lib/careerotter/comp-projection";
import {
  COMP_SOURCES,
  EXTERNAL_REF_MAX,
  type CompSource,
} from "@/lib/constants/careerotter";
import { AGENT_WRITE_QUOTAS } from "@/lib/constants/agent-access";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { isValidUUID } from "@/lib/utils/api-validation";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { DomainResult } from "@/types";

/** Field caps for comp entries, mirroring the column types in 033/035/040. */
export const COMP_LIMITS = {
  // numeric(12,2)
  amountMax: 9_999_999_999.99,
  // numeric(14,4)
  sharesMax: 9_999_999_999.9999,
  noteMax: 500,
  tickerMax: 10,
  vestYearsMax: 10,
  vestCliffMonthsMax: 60,
} as const;

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;
const MONTHS_PER_YEAR = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const COMP_TABLE = "comp_entries";
const EXTERNAL_REF_CONSTRAINT = "comp_entries_user_external_ref_key";
const UNIQUE_VIOLATION_CODE = "23505";
const COMP_SERVICE_SELECT =
  "id, effective_date, base, bonus, equity, currency, note, ticker, shares, vest_start, vest_years, vest_cliff_months, source, external_ref, updated_at, created_at";

const AMOUNT_MAX_LABEL = "9,999,999,999.99";

const MESSAGES = {
  effectiveDate: "effective_date must be a valid YYYY-MM-DD date",
  base: "base must be a non-negative number",
  ticker: "ticker must be 1-10 letters, digits, dots or hyphens",
  shares: "shares must be a non-negative number no larger than 9,999,999,999.9999",
  vestStart: "vest_start must be a valid YYYY-MM-DD date",
  vestYears: "vest_years must be a number between 0 and 10",
  vestCliff: "vest_cliff_months must be a whole number between 0 and 60",
  cliffNeedsVest: "vest_cliff_months requires vest_years",
  cliffTooLong: "vest_cliff_months cannot exceed the vesting duration",
  externalRef: `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`,
  immutable: "external_ref and source cannot be changed",
  notFound: "Comp entry not found",
  refConflict: "A comp entry with this external_ref was removed while saving; try again",
  agentQuota: `Agents can add at most ${AGENT_WRITE_QUOTAS.compEntriesPer24h} comp entries per 24 hours`,
  totalCap: `You can keep at most ${AGENT_WRITE_QUOTAS.compEntriesTotal} comp entries`,
  loadFailed: "Failed to load comp entries",
  saveFailed: "Failed to save comp entry",
  updateFailed: "Failed to update comp entry",
  deleteFailed: "Failed to delete comp entry",
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

interface FailureContext {
  userId: string;
  action: string;
  logMessage: string;
  publicMessage: string;
}

type Row = Record<string, unknown>;

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

/**
 * True only for a real calendar date in YYYY-MM-DD form — the regex alone
 * accepts impossible dates like 2026-02-29, which would then fail at insert
 * time as a 500 instead of a validation 400.
 */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, ISO_DATE_LENGTH) === value
  );
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}

function amountTooLarge(field: string): string {
  return `${field} must be no larger than ${AMOUNT_MAX_LABEL}`;
}

function parseBase(raw: unknown): DomainResult<number> {
  const base = nonNegativeNumber(raw);
  if (base === null) return invalid(MESSAGES.base);
  if (base > COMP_LIMITS.amountMax) return invalid(amountTooLarge("base"));
  return ok(base);
}

// Bonus and equity are optional: anything that isn't a non-negative number is
// stored as 0, but a real number too large for the column is an error rather
// than silently zeroed.
function parseOptionalAmount(field: string, raw: unknown): DomainResult<number> {
  const amount = nonNegativeNumber(raw);
  if (amount === null) return ok(0);
  if (amount > COMP_LIMITS.amountMax) return invalid(amountTooLarge(field));
  return ok(amount);
}

function parseNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw.trim().slice(0, COMP_LIMITS.noteMax) || null;
}

function parseTicker(raw: unknown): DomainResult<string | null> {
  if (typeof raw !== "string") return ok(null);
  const ticker = raw.trim().toUpperCase().slice(0, COMP_LIMITS.tickerMax) || null;
  if (ticker !== null && !TICKER_PATTERN.test(ticker)) return invalid(MESSAGES.ticker);
  return ok(ticker);
}

// Optional, but a supplied value must be storable: rejected rather than
// silently dropped, so bad input is never lost without a message.
function parseShares(raw: unknown): DomainResult<number | null> {
  if (!isPresent(raw)) return ok(null);
  const shares = nonNegativeNumber(raw);
  if (shares === null || shares > COMP_LIMITS.sharesMax) return invalid(MESSAGES.shares);
  return ok(shares);
}

function parseVestStart(raw: unknown): DomainResult<string | null> {
  if (!isPresent(raw) || raw === "") return ok(null);
  return isIsoDate(raw) ? ok(raw) : invalid(MESSAGES.vestStart);
}

function parseVestYears(raw: unknown): DomainResult<number | null> {
  if (!isPresent(raw)) return ok(null);
  if (typeof raw !== "number" || !Number.isFinite(raw)) return invalid(MESSAGES.vestYears);
  if (raw <= 0 || raw > COMP_LIMITS.vestYearsMax) return invalid(MESSAGES.vestYears);
  return ok(raw);
}

function parseVestCliff(raw: unknown): DomainResult<number | null> {
  if (!isPresent(raw)) return ok(null);
  if (typeof raw !== "number" || !Number.isInteger(raw)) return invalid(MESSAGES.vestCliff);
  if (raw < 0 || raw > COMP_LIMITS.vestCliffMonthsMax) return invalid(MESSAGES.vestCliff);
  return ok(raw);
}

// A cliff only means something relative to a vest schedule: without a duration
// the projection would silently ignore it, and a cliff longer than the vest
// describes a schedule that never pays until after it ends.
function checkCliffFitsVest(
  cliffMonths: number | null,
  vestYears: number | null
): DomainResult<null> {
  if (cliffMonths === null || cliffMonths === 0) return ok(null);
  if (vestYears === null) return invalid(MESSAGES.cliffNeedsVest);
  if (cliffMonths > Math.round(vestYears * MONTHS_PER_YEAR)) {
    return invalid(MESSAGES.cliffTooLong);
  }
  return ok(null);
}

type AmountFields = Pick<CompFields, "base" | "bonus" | "equity">;
type GrantFields = Pick<CompFields, "ticker" | "shares">;
type VestFields = Pick<CompFields, "vest_start" | "vest_years" | "vest_cliff_months">;

function parseAmounts(input: CompFieldsInput): DomainResult<AmountFields> {
  const base = parseBase(input.base);
  if (!base.ok) return base;
  const bonus = parseOptionalAmount("bonus", input.bonus);
  if (!bonus.ok) return bonus;
  const equity = parseOptionalAmount("equity", input.equity);
  if (!equity.ok) return equity;
  return ok({ base: base.value, bonus: bonus.value, equity: equity.value });
}

function parseGrant(input: CompFieldsInput): DomainResult<GrantFields> {
  const ticker = parseTicker(input.ticker);
  if (!ticker.ok) return ticker;
  const shares = parseShares(input.shares);
  if (!shares.ok) return shares;
  return ok({ ticker: ticker.value, shares: shares.value });
}

function parseVesting(input: CompFieldsInput): DomainResult<VestFields> {
  const vestStart = parseVestStart(input.vest_start);
  if (!vestStart.ok) return vestStart;
  const vestYears = parseVestYears(input.vest_years);
  if (!vestYears.ok) return vestYears;
  const cliff = parseVestCliff(input.vest_cliff_months);
  if (!cliff.ok) return cliff;
  const fits = checkCliffFitsVest(cliff.value, vestYears.value);
  if (!fits.ok) return fits;
  return ok({
    vest_start: vestStart.value,
    vest_years: vestYears.value,
    vest_cliff_months: cliff.value,
  });
}

function validateCompFields(input: CompFieldsInput): DomainResult<CompFields> {
  if (!isIsoDate(input.effective_date)) return invalid(MESSAGES.effectiveDate);
  const amounts = parseAmounts(input);
  if (!amounts.ok) return amounts;
  const grant = parseGrant(input);
  if (!grant.ok) return grant;
  const vesting = parseVesting(input);
  if (!vesting.ok) return vesting;
  return ok({
    effective_date: input.effective_date,
    ...amounts.value,
    note: parseNote(input.note),
    ...grant.value,
    ...vesting.value,
  });
}

function parseExternalRef(raw: unknown): DomainResult<string | null> {
  if (!isPresent(raw)) return ok(null);
  if (typeof raw !== "string") return invalid(MESSAGES.externalRef);
  const ref = raw.trim();
  if (ref.length === 0 || ref.length > EXTERNAL_REF_MAX) return invalid(MESSAGES.externalRef);
  return ok(ref);
}

/**
 * Validates and normalizes a new comp entry. Invalid optional bonus/equity are
 * stored as 0; note is trimmed and capped; ticker is trimmed, uppercased and
 * capped before its charset is checked.
 */
export function validateCompInput(input: CompInput): DomainResult<ValidCompInput> {
  const fields = validateCompFields(input);
  if (!fields.ok) return fields;
  const externalRef = parseExternalRef(input.external_ref);
  if (!externalRef.ok) return externalRef;
  return ok({ ...fields.value, external_ref: externalRef.value });
}

// ── row mapping ────────────────────────────────────────────────────────────

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function toStoredCompEntry(row: unknown): StoredCompEntry | null {
  if (!isRow(row)) return null;
  const { id, effective_date, currency, created_at, source } = row;
  const base = numberOrNull(row.base);
  const bonus = numberOrNull(row.bonus);
  const equity = numberOrNull(row.equity);
  if (typeof id !== "string" || typeof effective_date !== "string") return null;
  if (typeof currency !== "string" || typeof created_at !== "string") return null;
  if (!isCompSource(source) || base === null || bonus === null || equity === null) {
    return null;
  }
  return {
    id,
    effective_date,
    base,
    bonus,
    equity,
    currency,
    note: stringOrNull(row.note),
    ticker: stringOrNull(row.ticker),
    shares: numberOrNull(row.shares),
    vest_start: stringOrNull(row.vest_start),
    vest_years: numberOrNull(row.vest_years),
    vest_cliff_months: numberOrNull(row.vest_cliff_months),
    source,
    external_ref: stringOrNull(row.external_ref),
    updated_at: stringOrNull(row.updated_at),
    created_at,
  };
}

/** The fields the REST API has always returned for a comp entry. */
export function toCompEntry(entry: StoredCompEntry): CompEntry {
  return {
    id: entry.id,
    effective_date: entry.effective_date,
    base: entry.base,
    bonus: entry.bonus,
    equity: entry.equity,
    currency: entry.currency,
    note: entry.note,
    ticker: entry.ticker,
    shares: entry.shares,
    vest_start: entry.vest_start,
    vest_years: entry.vest_years,
    vest_cliff_months: entry.vest_cliff_months,
  };
}

/** Maps a single returned row, treating a malformed row as a database fault. */
function storedOrFailure(
  row: unknown,
  context: FailureContext
): DomainResult<StoredCompEntry> {
  const entry = toStoredCompEntry(row);
  if (entry === null) return dbFailure(context, new Error("Malformed comp_entries row"));
  return ok(entry);
}

// ── reads ──────────────────────────────────────────────────────────────────

/** All of the user's comp entries, oldest effective date first. */
export async function listCompEntries(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<StoredCompEntry[]>> {
  const context: FailureContext = {
    userId,
    action: "comp_entries_list_failed",
    logMessage: "Failed to load comp entries",
    publicMessage: MESSAGES.loadFailed,
  };
  return guarded(context, async () => {
    const { data, error } = await admin
      .from(COMP_TABLE)
      .select(COMP_SERVICE_SELECT)
      .eq("user_id", userId)
      .order("effective_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return dbFailure(context, error);
    const rows: unknown[] = Array.isArray(data) ? data : [];
    const entries: StoredCompEntry[] = [];
    for (const row of rows) {
      const entry = storedOrFailure(row, context);
      if (!entry.ok) return entry;
      entries.push(entry.value);
    }
    return ok(entries);
  });
}

function compareCreatedAt(a: { created_at: string }, b: { created_at: string }): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

/**
 * The package in effect on `asOf` (latest effective_date on or before that UTC
 * date; ties go to the most recently created entry) and the earliest
 * future-dated one, e.g. an accepted offer that has not started yet.
 */
export function currentCompEntry<T extends { effective_date: string; created_at: string }>(
  entries: readonly T[],
  asOf: Date
): CurrentCompEntries<T> {
  const asOfDate = asOf.toISOString().slice(0, ISO_DATE_LENGTH);
  let current: T | null = null;
  let upcoming: T | null = null;
  for (const entry of entries) {
    if (entry.effective_date <= asOfDate) {
      const later =
        current === null ||
        entry.effective_date > current.effective_date ||
        (entry.effective_date === current.effective_date && compareCreatedAt(entry, current) > 0);
      if (later) current = entry;
    } else {
      const sooner =
        upcoming === null ||
        entry.effective_date < upcoming.effective_date ||
        (entry.effective_date === upcoming.effective_date && compareCreatedAt(entry, upcoming) > 0);
      if (sooner) upcoming = entry;
    }
  }
  return { current, upcoming };
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
    query = query.eq("source", "agent").gte("created_at", agentSince);
  }
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

async function checkQuota(
  admin: SupabaseClient,
  userId: string,
  source: CompSource,
  context: FailureContext
): Promise<DomainResult<null>> {
  if (source === "agent") {
    const since = new Date(Date.now() - MS_PER_DAY).toISOString();
    const recent = await countEntries(admin, userId, since);
    if (recent.error) return dbFailure(context, recent.error);
    if (recent.count >= AGENT_WRITE_QUOTAS.compEntriesPer24h) {
      return { ok: false, kind: "quota", message: MESSAGES.agentQuota };
    }
  }
  const total = await countEntries(admin, userId, null);
  if (total.error) return dbFailure(context, total.error);
  if (total.count >= AGENT_WRITE_QUOTAS.compEntriesTotal) {
    return { ok: false, kind: "quota", message: MESSAGES.totalCap };
  }
  return ok(null);
}

async function findByExternalRef(
  admin: SupabaseClient,
  userId: string,
  externalRef: string,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry | null>> {
  const { data, error } = await admin
    .from(COMP_TABLE)
    .select(COMP_SERVICE_SELECT)
    .eq("user_id", userId)
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return ok(null);
  return storedOrFailure(data, context);
}

function isExternalRefViolation(error: unknown): boolean {
  if (!isRow(error) || error.code !== UNIQUE_VIOLATION_CODE) return false;
  const text = `${stringOrNull(error.message) ?? ""} ${stringOrNull(error.details) ?? ""}`;
  return text.includes(EXTERNAL_REF_CONSTRAINT);
}

async function existingDuplicate(
  admin: SupabaseClient,
  userId: string,
  externalRef: string,
  context: FailureContext
): Promise<DomainResult<CreatedCompEntry>> {
  const existing = await findByExternalRef(admin, userId, externalRef, context);
  if (!existing.ok) return existing;
  if (existing.value === null) {
    return { ok: false, kind: "conflict", message: MESSAGES.refConflict };
  }
  return ok({ entry: existing.value, duplicate: true });
}

function captureCompEntered(userId: string, entry: StoredCompEntry, source: CompSource): void {
  // The agent path deliberately sends no amount: a salary figure should not
  // leave the app because an agent wrote it.
  const properties =
    source === "agent"
      ? { source }
      : { total: entry.base + entry.bonus + entry.equity };
  after(captureServerEvent(userId, CAREEROTTER_EVENT_NAMES.COMP_ENTERED, properties));
}

async function insertCompEntry(
  admin: SupabaseClient,
  userId: string,
  input: ValidCompInput,
  source: CompSource,
  context: FailureContext
): Promise<DomainResult<CreatedCompEntry>> {
  const { data, error } = await admin
    .from(COMP_TABLE)
    .insert({ user_id: userId, ...input, source })
    .select(COMP_SERVICE_SELECT)
    .single();
  if (error) {
    if (input.external_ref !== null && isExternalRefViolation(error)) {
      return existingDuplicate(admin, userId, input.external_ref, context);
    }
    return dbFailure(context, error);
  }
  const entry = storedOrFailure(data, context);
  if (!entry.ok) return entry;
  captureCompEntered(userId, entry.value, source);
  return ok({ entry: entry.value, duplicate: false });
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
  const context: FailureContext = {
    userId,
    action: "comp_entry_failed",
    logMessage: "Failed to add comp entry",
    publicMessage: MESSAGES.saveFailed,
  };
  return guarded(context, async () => {
    const valid = validateCompInput(input);
    if (!valid.ok) return valid;
    const quota = await checkQuota(admin, userId, options.source, context);
    if (!quota.ok) {
      // A retry of a write that already landed must stay idempotent even when
      // that write was the one that filled the quota.
      const ref = valid.value.external_ref;
      if (quota.kind !== "quota" || ref === null) return quota;
      const existing = await existingDuplicate(admin, userId, ref, context);
      return existing.ok ? existing : quota;
    }
    return insertCompEntry(admin, userId, valid.value, options.source, context);
  });
}

// ── update ─────────────────────────────────────────────────────────────────

async function loadScopedEntry(
  admin: SupabaseClient,
  userId: string,
  id: string,
  scope: CompWriteScope,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry>> {
  let query = admin
    .from(COMP_TABLE)
    .select(COMP_SERVICE_SELECT)
    .eq("id", id)
    .eq("user_id", userId);
  if (scope.onlySource) query = query.eq("source", scope.onlySource);
  const { data, error } = await query.maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return notFound();
  return storedOrFailure(data, context);
}

function mergePatch(existing: CompFields, patch: CompPatch): CompFieldsInput {
  const merged: CompFieldsInput = {};
  for (const name of COMP_FIELD_NAMES) {
    merged[name] = patch[name] === undefined ? existing[name] : patch[name];
  }
  return merged;
}

async function writeUpdate(
  admin: SupabaseClient,
  userId: string,
  id: string,
  fields: CompFields,
  scope: CompWriteScope,
  context: FailureContext
): Promise<DomainResult<StoredCompEntry>> {
  let query = admin
    .from(COMP_TABLE)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (scope.onlySource) query = query.eq("source", scope.onlySource);
  const { data, error } = await query.select(COMP_SERVICE_SELECT).maybeSingle();
  if (error) return dbFailure(context, error);
  // Deleted between the read and the write.
  if (data === null) return notFound();
  return storedOrFailure(data, context);
}

/**
 * Edits a comp entry. The merged row is validated as a whole, so e.g. clearing
 * vest_years while a cliff is set fails. With `onlySource`, rows from any other
 * source are reported as not found.
 */
export async function updateCompEntry(
  admin: SupabaseClient,
  userId: string,
  id: string,
  patch: CompPatch,
  scope: CompWriteScope = {}
): Promise<DomainResult<StoredCompEntry>> {
  const context: FailureContext = {
    userId,
    action: "comp_entry_update_failed",
    logMessage: "Failed to update comp entry",
    publicMessage: MESSAGES.updateFailed,
  };
  return guarded(context, async () => {
    if (!isValidUUID(id)) return notFound();
    if (patch.external_ref !== undefined || patch.source !== undefined) {
      return invalid(MESSAGES.immutable);
    }
    const existing = await loadScopedEntry(admin, userId, id, scope, context);
    if (!existing.ok) return existing;
    const fields = validateCompFields(mergePatch(existing.value, patch));
    if (!fields.ok) return fields;
    return writeUpdate(admin, userId, id, fields.value, scope, context);
  });
}

// ── delete ─────────────────────────────────────────────────────────────────

/** Deletes a comp entry; a missing row (or one outside `onlySource`) is not_found. */
export async function deleteCompEntry(
  admin: SupabaseClient,
  userId: string,
  id: string,
  scope: CompWriteScope = {}
): Promise<DomainResult<{ id: string }>> {
  const context: FailureContext = {
    userId,
    action: "comp_entry_delete_failed",
    logMessage: "Failed to delete comp entry",
    publicMessage: MESSAGES.deleteFailed,
  };
  return guarded(context, async () => {
    if (!isValidUUID(id)) return notFound();
    let query = admin.from(COMP_TABLE).delete().eq("id", id).eq("user_id", userId);
    if (scope.onlySource) query = query.eq("source", scope.onlySource);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return dbFailure(context, error);
    if (data === null) return notFound();
    return ok({ id });
  });
}
