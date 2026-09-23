/** The settled value, or a marker that the deadline passed first. */
export type TimeoutResult<T> = { timedOut: false; value: T } | { timedOut: true };

/**
 * Races `promise` against a deadline of `ms` milliseconds. A rejection before
 * the deadline propagates; the timer is always cleared. The race subscribes to
 * `promise`, so a rejection that lands after the deadline is observed and can
 * never surface as an unhandled rejection. The underlying work is not
 * cancelled, only no longer waited for.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<TimeoutResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<TimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  const settled = promise.then((value): TimeoutResult<T> => ({ timedOut: false, value }));
  try {
    return await Promise.race([settled, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
