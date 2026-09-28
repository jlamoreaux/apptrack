/**
 * @jest-environment node
 */
/**
 * withTimeout (lib/utils/with-timeout.ts): resolves with the value before the
 * deadline, reports timedOut after it, propagates an early rejection, clears
 * its timer, and never leaves a late rejection unhandled.
 * withAbortableTimeout: aborts the work's signal at the deadline, and leaves
 * it untouched when the work settles first.
 */

import { withAbortableTimeout, withTimeout } from "@/lib/utils/with-timeout";

const DEADLINE_MS = 1_000;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
});
afterEach(() => {
  jest.useRealTimers();
});

it("resolves with the value when the promise settles first", async () => {
  await expect(withTimeout(Promise.resolve("done"), DEADLINE_MS)).resolves.toEqual({
    timedOut: false,
    value: "done",
  });
  expect(jest.getTimerCount()).toBe(0);
});

it("reports timedOut when the deadline passes first", async () => {
  const pending = withTimeout(new Promise<string>(() => undefined), DEADLINE_MS);
  await jest.advanceTimersByTimeAsync(DEADLINE_MS);
  await expect(pending).resolves.toEqual({ timedOut: true });
});

it("propagates a rejection that lands before the deadline", async () => {
  await expect(withTimeout(Promise.reject(new Error("boom")), DEADLINE_MS)).rejects.toThrow(
    "boom"
  );
  expect(jest.getTimerCount()).toBe(0);
});

it("does not leave a rejection after the deadline unhandled", async () => {
  const onUnhandled = jest.fn();
  process.on("unhandledRejection", onUnhandled);
  let rejectLate: (reason: Error) => void = () => undefined;
  const late = new Promise<string>((_resolve, rejectFn) => {
    rejectLate = rejectFn;
  });
  const pending = withTimeout(late, DEADLINE_MS);
  await jest.advanceTimersByTimeAsync(DEADLINE_MS);
  await pending;
  rejectLate(new Error("late"));
  await new Promise((resolve) => setImmediate(resolve));
  process.off("unhandledRejection", onUnhandled);
  expect(onUnhandled).not.toHaveBeenCalled();
});

describe("withAbortableTimeout", () => {
  it("aborts the signal when the deadline passes first", async () => {
    const seen: { signal?: AbortSignal } = {};
    const pending = withAbortableTimeout((signal) => {
      seen.signal = signal;
      return new Promise<string>(() => undefined);
    }, DEADLINE_MS);
    expect(seen.signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(DEADLINE_MS);
    await expect(pending).resolves.toEqual({ timedOut: true });
    expect(seen.signal?.aborted).toBe(true);
  });

  it("does not abort when the work settles first", async () => {
    const seen: { signal?: AbortSignal } = {};
    const outcome = await withAbortableTimeout((signal) => {
      seen.signal = signal;
      return Promise.resolve("done");
    }, DEADLINE_MS);
    expect(outcome).toEqual({ timedOut: false, value: "done" });
    expect(jest.getTimerCount()).toBe(0);
    expect(seen.signal?.aborted).toBe(false);
  });

  it("does not leave the aborted work's rejection unhandled", async () => {
    const onUnhandled = jest.fn();
    process.on("unhandledRejection", onUnhandled);
    const pending = withAbortableTimeout(
      (signal) =>
        new Promise<string>((_resolve, rejectFn) => {
          signal.addEventListener("abort", () => rejectFn(new Error("aborted")));
        }),
      DEADLINE_MS
    );
    await jest.advanceTimersByTimeAsync(DEADLINE_MS);
    await expect(pending).resolves.toEqual({ timedOut: true });
    await new Promise((resolve) => setImmediate(resolve));
    process.off("unhandledRejection", onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });
});
