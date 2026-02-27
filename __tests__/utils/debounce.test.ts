/**
 * Tests for lib/utils/debounce.ts
 * Debounce utility – only tests the plain `debounce` function (not the React hook).
 */

// @jest-environment node

import { debounce } from '@/lib/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not call the function immediately when invoked', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();

    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the function once after the delay elapses', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    jest.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls the function only once even when invoked multiple times within the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    debounced();
    debounced();
    jest.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses the arguments from the most recent invocation within the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    debounced('second');
    debounced('third');
    jest.runAllTimers();

    expect(fn).toHaveBeenCalledWith('third');
  });

  it('calls the function immediately after the delay if invoked only once', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced('hello');

    // Not yet called before the delay
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('hello');
  });

  it('resets the timer when called again before the delay expires', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    jest.advanceTimersByTime(200); // 200ms in — not yet fired
    debounced('b');                // resets the timer
    jest.advanceTimersByTime(200); // 200ms more (400ms total) — still within new 300ms window
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100); // now the full 300ms since last call has elapsed
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('can be called again after the initial delay and fires again', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('first call');
    jest.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);

    debounced('second call');
    jest.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second call');
  });
});
