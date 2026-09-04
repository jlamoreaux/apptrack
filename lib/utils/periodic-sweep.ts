/**
 * Access-triggered sweeping for in-process caches and rate-limit maps.
 *
 * WHY THIS EXISTS
 * These structures used module-scope `setInterval` to evict expired entries. That is a
 * hard blocker on Cloudflare Workers: a Worker has no persistent timer between requests,
 * and scheduling I/O at module scope raises "Cannot perform I/O on behalf of a different
 * request". Sweeping when the map is next touched achieves the same bounded-memory goal
 * with no timer at all, and behaves identically on Node.
 *
 * WHAT THIS DOES NOT FIX
 * These maps live in one process's memory. On Vercel that means per-lambda, and on
 * Workers per-isolate — so an in-memory rate limit is already best-effort rather than a
 * real distributed limit, whichever runtime you are on. Genuine rate limiting belongs in
 * Durable Objects (strong consistency) or the existing Upstash-backed
 * `lib/services/rate-limit.service.ts`. This helper preserves today's behaviour while
 * removing the Workers blocker; it does not make the limits correct.
 */

/**
 * Wraps a sweep function so it runs at most once per `intervalMs`, triggered by callers
 * rather than a timer. Cheap enough to call on every access: the common path is one
 * `Date.now()` comparison.
 *
 * The first call does not sweep — a freshly created map has nothing to evict, and this
 * avoids paying the sweep cost on a cold start.
 */
export function createSweeper(sweep: () => void, intervalMs: number): () => void {
  let lastSweep = Date.now();

  return function maybeSweep(): void {
    const now = Date.now();
    if (now - lastSweep < intervalMs) return;
    lastSweep = now;
    sweep();
  };
}

/**
 * Removes every entry whose expiry has passed.
 *
 * `getExpiry` reads the expiry timestamp (epoch ms) from a value, so this works across
 * the several shapes already in the codebase (`resetTime`, `resetAt`, `expiresAt`).
 */
export function sweepExpired<K, V>(
  map: Map<K, V>,
  getExpiry: (value: V) => number,
  now: number = Date.now()
): number {
  let removed = 0;
  for (const [key, value] of map) {
    if (now > getExpiry(value)) {
      map.delete(key);
      removed++;
    }
  }
  return removed;
}
