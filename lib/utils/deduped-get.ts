/**
 * Collapse redundant client-side GETs of the same URL.
 *
 * The dashboard mounts several copies of the auth/onboarding hooks, and each one
 * fired its own request on mount — plus again on Supabase's INITIAL_SESSION event.
 * The result was `/api/auth/profile` fetched ~7x and `/api/onboarding/status` ~4x
 * on a single load. A per-URL in-flight promise collapses the simultaneous burst;
 * a short TTL cache absorbs the near-sequential stragglers. The TTL is deliberately
 * tiny so a genuinely new navigation still refetches fresh data.
 */

type Result = { ok: boolean; status: number; body: unknown };

const inFlight = new Map<string, Promise<Result>>();
const cache = new Map<string, { at: number; value: Result }>();

// Bumped by clearGetCache() on every auth change. A request captures the epoch at
// start; if it changes before the request resolves, the auth session turned over
// mid-flight (e.g. sign-out) and the response belongs to the previous user — so we
// must not cache it, and callers must not apply it. Guards against CWE-362: a slow
// account-A response completing after sign-out (or after account B signs in).
let epoch = 0;

const DEFAULT_TTL_MS = 5_000;

export function getGetCacheEpoch(): number {
  return epoch;
}

export async function dedupedGetJson(
  url: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<Result> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < ttlMs) {
    return cached.value;
  }

  const existing = inFlight.get(url);
  if (existing) return existing;

  const startEpoch = epoch;
  const request = (async (): Promise<Result> => {
    const res = await fetch(url, { method: "GET", credentials: "include" });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  })();

  inFlight.set(url, request);
  try {
    const value = await request;
    // Cache only a successful read from the still-current auth session. A 4xx/5xx,
    // a thrown request, or an auth turnover mid-flight (epoch changed) leaves no
    // entry, so the next caller retries / fetches fresh rather than being pinned to
    // a stale-or-failed value for the whole TTL.
    if (value.ok && epoch === startEpoch) {
      cache.set(url, { at: Date.now(), value });
    }
    return value;
  } finally {
    // Only reclaim our own in-flight slot; if clearGetCache() ran, the map was
    // already wiped and a newer request may own this URL.
    if (epoch === startEpoch) {
      inFlight.delete(url);
    }
  }
}

/**
 * Wipe the cache and advance the auth epoch. The store is a module-level singleton
 * shared across the client session, so it MUST be cleared on any auth change
 * (sign-in/out) — otherwise a newly signed-in user could be served the previous
 * user's cached response (e.g. their profile). Advancing the epoch also neutralizes
 * any request already in flight so its late response can't repopulate the cache.
 */
export function clearGetCache(): void {
  epoch++;
  cache.clear();
  inFlight.clear();
}
