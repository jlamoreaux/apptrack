/**
 * True for a path that is safe to redirect to after auth: site-relative,
 * not protocol-relative, not an absolute URL, and free of the backslashes
 * that URL parsing normalizes into a second slash. Guards the redirectTo and
 * next parameters against open redirects.
 */
export function isValidInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
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
