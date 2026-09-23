/**
 * @jest-environment node
 */
/**
 * withTimeout (lib/utils/with-timeout.ts): resolves with the value before the
 * deadline, reports timedOut after it, propagates an early rejection, clears
 * its timer, and never leaves a late rejection unhandled.
 */

import { withTimeout } from "@/lib/utils/with-timeout";

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
