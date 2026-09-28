/** The settled value, or a marker that the deadline passed first. */
export type TimeoutResult<T> = { timedOut: false; value: T } | { timedOut: true };

/**
 * Races `promise` against a deadline of `ms` milliseconds. A rejection before
 * the deadline propagates; the timer is always cleared. The race subscribes to
 * `promise`, so a rejection that lands after the deadline is observed and can
 * never surface as an unhandled rejection. The underlying work is not
 * cancelled, only no longer waited for; use withAbortableTimeout when the
 * work accepts an AbortSignal.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<TimeoutResult<T>> {
  return raceDeadline(promise, ms, () => undefined);
}

/**
 * Like withTimeout, but starts the work with an AbortSignal and aborts it when
 * the deadline passes, so an abandoned request (e.g. a fetch) stops instead
 * of running on after nobody waits for it. The signal is never aborted when
 * the work settles first.
 */
export async function withAbortableTimeout<T>(
  start: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<TimeoutResult<T>> {
  const controller = new AbortController();
  return raceDeadline(start(controller.signal), ms, () => controller.abort());
}

async function raceDeadline<T>(
  promise: Promise<T>,
  ms: number,
  onDeadline: () => void
): Promise<TimeoutResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<TimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => {
      resolve({ timedOut: true });
      onDeadline();
    }, ms);
  });
  const settled = promise.then((value): TimeoutResult<T> => ({ timedOut: false, value }));
  try {
    return await Promise.race([settled, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
