/** URL helpers shared by the OAuth redirect URI and resource checks. */

import { hasControlCharacter, isWellFormedUtf16 } from "@/lib/careerotter/field-guards";

const FRAGMENT_DELIMITER = "#";
const WHITESPACE = /\s/;

/**
 * True when a raw URI string holds whitespace (space included), a control
 * character (C0, DEL or C1) or a lone surrogate. URL would silently strip,
 * percent-encode or replace these, so the string a client registers could
 * differ from the one it later presents.
 */
export function hasUnsafeUriCharacters(raw: string): boolean {
  return WHITESPACE.test(raw) || hasControlCharacter(raw) || !isWellFormedUtf16(raw);
}

/** The parsed absolute URL, or null when `value` isn't one. */
export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * True when the raw string has a fragment. Checked on the raw string because
 * URL reports an empty fragment ("…#") as no fragment at all.
 */
export function hasFragment(raw: string): boolean {
  return raw.includes(FRAGMENT_DELIMITER);
}

export function hasCredentials(url: URL): boolean {
  return url.username !== "" || url.password !== "";
}
