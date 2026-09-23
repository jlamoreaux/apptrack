/** URL helpers shared by the OAuth redirect URI and resource checks. */

const FRAGMENT_DELIMITER = "#";

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
