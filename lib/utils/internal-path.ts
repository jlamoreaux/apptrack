// Control characters (C0 and DEL) and any whitespace. The WHATWG URL parser
// silently strips tab, LF and CR, so "/\t/evil.com" would parse as
// "//evil.com"; none of these belong in a redirect target.
const UNSAFE_PATH_CHARACTERS = /[\u0000-\u001F\u007F\s]/;

/**
 * True for a path that is safe to redirect to after auth: site-relative,
 * not protocol-relative, not an absolute URL, and free of the backslashes,
 * control characters and whitespace that URL parsing normalizes away (into a
 * second slash, or into nothing). Guards the redirectTo and next parameters
 * against open redirects.
 */
export function isValidInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (UNSAFE_PATH_CHARACTERS.test(path)) return false;
  if (path.includes("://")) return false;
  return true;
}

/**
 * Resolve a redirect target against the site origin and hand it back only if
 * it stayed on that origin. The string check above is the first line; this
 * is the one that cannot be fooled by an encoding it did not anticipate.
 */
export function resolveInternalUrl(path: unknown, origin: string): URL | null {
  if (!isValidInternalPath(path)) return null;
  try {
    const url = new URL(path, origin);
    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

/**
 * The same-origin path to navigate to, as the URL parser resolved it
 * (pathname, search and hash), or null. Navigating to this rather than the
 * raw input means the browser can't read it differently from the check.
 */
export function safeInternalPath(path: unknown, origin: string): string | null {
  const url = resolveInternalUrl(path, origin);
  return url === null ? null : `${url.pathname}${url.search}${url.hash}`;
}
