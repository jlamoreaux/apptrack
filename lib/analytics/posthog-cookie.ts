/**
 * Read the browser's PostHog distinct_id from a Cookie header so server-side events
 * attach to the same person as the client session. posthog-js stores its state in a
 * cookie named `ph_<project token>_posthog`; only the configured project's cookie is
 * read, so a browser holding cookies for several projects resolves to the right one.
 * Returns undefined when absent or unparseable.
 */
export function distinctIdFromCookieHeader(
  cookieHeader: string | string[] | undefined,
  projectToken: string | undefined = process.env.NEXT_PUBLIC_POSTHOG_KEY
): string | undefined {
  if (!projectToken) return undefined;
  const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!header) return undefined;

  const name = `ph_${projectToken}_posthog=`;
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name));
  if (!entry) return undefined;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(entry.slice(name.length)));
    if (parsed && typeof parsed === "object" && "distinct_id" in parsed) {
      const id = (parsed as { distinct_id: unknown }).distinct_id;
      return typeof id === "string" && id ? id : undefined;
    }
  } catch {
    // Malformed cookie: report the error anonymously
  }
  return undefined;
}
