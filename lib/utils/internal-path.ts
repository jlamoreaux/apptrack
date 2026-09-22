/**
 * True for a path that is safe to redirect to after auth: site-relative,
 * not protocol-relative, and not an absolute URL. Guards the redirectTo and
 * next parameters against open redirects.
 */
export function isValidInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}
