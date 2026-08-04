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

const DEFAULT_TTL_MS = 5_000;

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
    // Only successful reads are cached; a thrown request leaves no entry so the
    // next caller retries.
    cache.set(url, { at: Date.now(), value });
    return value;
  } finally {
    inFlight.delete(url);
  }
}

/**
 * Drop any cached/in-flight result for a URL. Call after something invalidates it
 * (a mutation, or an auth change such as sign-out) so the next read fetches fresh.
 */
export function invalidateGet(url: string): void {
  cache.delete(url);
  inFlight.delete(url);
}
