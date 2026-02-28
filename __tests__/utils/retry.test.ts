/**
 * Tests for lib/utils/retry.ts
 * Exponential-backoff retry utility
 *
 * Notes on fake-timer usage:
 * - retry() uses `await new Promise(resolve => setTimeout(resolve, delay))` internally.
 * - We use `jest.runAllTimersAsync()` (Jest 29+) to flush macro-timers AND the
 *   microtask queue between timer firings so the async retry loop can complete.
 * - For tests where no delay fires (immediate throw), we avoid storing the
 *   promise before attaching a handler to prevent unhandled-rejection noise.
 */

// @jest-environment node

import { retry, HttpError } from '@/lib/utils/retry';

// Helper: always retry any error
const alwaysRetry = () => true;
// Helper: never retry any error
const neverRetry = () => false;

/** Run all pending timers and let the async chain settle. */
async function drainTimers() {
  await jest.runAllTimersAsync();
}

describe('retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it('resolves immediately when the operation succeeds on the first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    const promise = retry(operation, { maxRetries: 3, shouldRetry: neverRetry });
    await drainTimers();
    expect(await promise).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('resolves after retrying once when the first attempt fails and the second succeeds', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('recovered');

    const promise = retry(operation, {
      maxRetries: 3,
      initialDelay: 100,
      shouldRetry: alwaysRetry,
    });
    // Suppress the in-flight rejection so it is "handled"
    promise.catch(() => {});

    await drainTimers();
    expect(await promise).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries correctly and succeeds on the third attempt', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = retry(operation, {
      maxRetries: 3,
      initialDelay: 50,
      backoffFactor: 2,
      shouldRetry: alwaysRetry,
    });
    promise.catch(() => {});

    await drainTimers();
    expect(await promise).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  // ---------------------------------------------------------------------------
  // Failure / exhaustion cases
  // ---------------------------------------------------------------------------

  it('throws after exhausting all retries', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('always fails'));

    const promise = retry(operation, {
      maxRetries: 2,
      initialDelay: 50,
      shouldRetry: alwaysRetry,
    });
    promise.catch(() => {}); // prevent unhandled rejection while timers drain

    await drainTimers();
    await expect(promise).rejects.toThrow('always fails');
    // 1 initial attempt + 2 retries = 3 total calls
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry when maxRetries is 0', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('no retries'));

    // No timers needed — throws on first attempt, no delay is scheduled
    await expect(
      retry(operation, { maxRetries: 0, shouldRetry: alwaysRetry })
    ).rejects.toThrow('no retries');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry when shouldRetry returns false for the error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('non-retryable'));

    // No timers needed — shouldRetry=false means immediate throw, no delay
    await expect(
      retry(operation, { maxRetries: 5, shouldRetry: neverRetry })
    ).rejects.toThrow('non-retryable');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // HttpError retryability (default shouldRetry behaviour)
  // ---------------------------------------------------------------------------

  it('retries on HTTP 429 (rate-limit) by default', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new HttpError(429, 'Too Many Requests'))
      .mockResolvedValue('throttled-then-ok');

    const promise = retry(operation, { maxRetries: 2, initialDelay: 10 });
    promise.catch(() => {});

    await drainTimers();
    expect(await promise).toBe('throttled-then-ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 503 (server error) by default', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new HttpError(503, 'Service Unavailable'))
      .mockResolvedValue('server-recovered');

    const promise = retry(operation, { maxRetries: 2, initialDelay: 10 });
    promise.catch(() => {});

    await drainTimers();
    expect(await promise).toBe('server-recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on HTTP 400 (client error) by default', async () => {
    const operation = jest.fn().mockRejectedValue(new HttpError(400, 'Bad Request'));

    // HTTP 400 is not retryable — no timers, immediate throw
    await expect(
      retry(operation, { maxRetries: 3, initialDelay: 10 })
    ).rejects.toThrow('Bad Request');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on HTTP 404 by default', async () => {
    const operation = jest.fn().mockRejectedValue(new HttpError(404, 'Not Found'));

    await expect(
      retry(operation, { maxRetries: 3, initialDelay: 10 })
    ).rejects.toThrow('Not Found');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Exponential backoff: verify total call count
  // ---------------------------------------------------------------------------

  it('invokes the operation the correct total number of times (initial + maxRetries)', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('fail'));

    const promise = retry(operation, {
      maxRetries: 4,
      initialDelay: 50,
      backoffFactor: 2,
      shouldRetry: alwaysRetry,
    });
    promise.catch(() => {});

    await drainTimers();
    await expect(promise).rejects.toThrow('fail');

    // 1 initial + 4 retries = 5 total
    expect(operation).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// HttpError class
// ---------------------------------------------------------------------------
describe('HttpError', () => {
  it('stores the status code and message', () => {
    const err = new HttpError(500, 'Internal Server Error');
    expect(err.status).toBe(500);
    expect(err.message).toBe('Internal Server Error');
    expect(err.name).toBe('HttpError');
  });

  it('is an instance of Error', () => {
    expect(new HttpError(404, 'Not Found')).toBeInstanceOf(Error);
  });
});
