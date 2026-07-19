// Brand migration: apptrack.ing -> careerotter.io, page-for-page and permanent.
// Shared, pure, and dependency-free so both middleware.ts and the CI test import
// the same logic. Roast permalinks (/roast/:id) are the non-negotiable case —
// shared links must keep resolving forever — and are covered because the mapping
// preserves the full path + query.

// Hosts that must 301 to the canonical CareerOtter origin.
export const LEGACY_HOSTS = ["apptrack.ing", "www.apptrack.ing"] as const;

// Canonical origin. Env-driven so previews/staging differ; defaults to the
// go-forward domain. No trailing slash.
export const CANONICAL_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || "https://careerotter.io"
).replace(/\/+$/, "");

/**
 * If `host` is a legacy AppTrack host, return the absolute CareerOtter URL to
 * 301 to (preserving path + query). Otherwise null (no redirect).
 */
export function resolveLegacyRedirect(
  host: string | null | undefined,
  pathnameWithSearch: string
): string | null {
  const bareHost = (host || "").split(":")[0].toLowerCase();
  if ((LEGACY_HOSTS as readonly string[]).includes(bareHost)) {
    const path = pathnameWithSearch.startsWith("/")
      ? pathnameWithSearch
      : `/${pathnameWithSearch}`;
    return `${CANONICAL_ORIGIN}${path}`;
  }
  return null;
}
