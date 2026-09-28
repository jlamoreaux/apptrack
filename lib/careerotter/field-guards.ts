/**
 * Pure field guards shared by the client-safe comp entry validator and the
 * server-side domain services. No server imports, so the entry form and the
 * guest cache can use them.
 */

import { ISO_DATE_LENGTH, ISO_DATE_MIN, ISO_DATE_PATTERN } from "@/lib/constants/dates";

// C0 controls, DEL and C1 controls.
const C0_CONTROL_MAX = 0x1f;
const DEL_CODE_POINT = 0x7f;
const C1_CONTROL_MAX = 0x9f;
const NUL_CHARACTER = "\u0000";

// A high surrogate not followed by a low one, or a low one not preceded by a
// high one. String.prototype.isWellFormed does this, but the installed
// TypeScript lib predates it.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// Created on first use: this module also loads in the browser, and only the
// server truncates by grapheme.
let graphemeSegmenter: Intl.Segmenter | null = null;

function graphemesOf(value: string): Iterable<{ segment: string }> {
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return graphemeSegmenter.segment(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * True only for a YYYY-MM-DD string naming a real calendar date from year
 * 0001 on. The pattern alone accepts impossible dates like 2026-02-29, which
 * would then fail at insert time as a 500 instead of a validation 400.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  if (value < ISO_DATE_MIN) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && toIsoDate(parsed) === value;
}

/** Postgres text columns cannot store U+0000. */
export function hasNulCharacter(value: string): boolean {
  return value.includes(NUL_CHARACTER);
}

export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= C0_CONTROL_MAX) return true;
    if (code >= DEL_CODE_POINT && code <= C1_CONTROL_MAX) return true;
  }
  return false;
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** Truncates by code point, so a surrogate pair is never split. */
export function truncateCodePoints(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

/** False when the string holds a lone surrogate, which has no UTF-8 encoding. */
export function isWellFormedUtf16(value: string): boolean {
  return !LONE_SURROGATE.test(value);
}

/**
 * The longest prefix of whole graphemes (user-perceived characters, so an
 * emoji sequence or a letter with its accents is never split) that has at
 * most `max` graphemes and at most `max` code points. Both bounds apply
 * because one grapheme can be several code points, and database limits
 * (char_length) count code points.
 */
export function truncateGraphemes(value: string, max: number): string {
  let result = "";
  let graphemes = 0;
  let codePoints = 0;
  for (const { segment } of graphemesOf(value)) {
    const segmentCodePoints = codePointLength(segment);
    if (graphemes + 1 > max || codePoints + segmentCodePoints > max) break;
    result += segment;
    graphemes += 1;
    codePoints += segmentCodePoints;
  }
  return result;
}
