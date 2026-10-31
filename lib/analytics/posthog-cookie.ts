// posthog-js persists its state in a cookie named `ph_<project token>_posthog`.
const POSTHOG_COOKIE = /(?:^|;\s*)ph_phc_[^=]*_posthog=([^;]+)/;

/**
 * Read the browser's PostHog distinct_id from a Cookie header so server-side events
 * attach to the same person as the client session. Returns undefined when absent or
 * unparseable.
 */
export function distinctIdFromCookieHeader(
  cookieHeader: string | string[] | undefined
): string | undefined {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  const match = header?.match(POSTHOG_COOKIE);
  if (!match) return undefined;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]));
    if (parsed && typeof parsed === "object" && "distinct_id" in parsed) {
      const id = (parsed as { distinct_id: unknown }).distinct_id;
      return typeof id === "string" && id ? id : undefined;
    }
  } catch {
    // Malformed cookie: report the error anonymously
  }
  return undefined;
}
