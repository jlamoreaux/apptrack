/**
 * Tests for lib/constants/subscription-status.ts
 * Single source of truth for subscription status values and entitlement checks.
 */

// @jest-environment node

import {
  SUBSCRIPTION_STATUSES,
  ENTITLED_SUBSCRIPTION_STATUSES,
  isEntitledStatus,
} from '@/lib/constants/subscription-status';

describe('isEntitledStatus', () => {
  it('returns true for "active"', () => {
    expect(isEntitledStatus('active')).toBe(true);
  });

  it('returns true for "trialing"', () => {
    expect(isEntitledStatus('trialing')).toBe(true);
  });

  it('returns false for "past_due"', () => {
    expect(isEntitledStatus('past_due')).toBe(false);
  });

  it('returns false for "canceled"', () => {
    expect(isEntitledStatus('canceled')).toBe(false);
  });

  it('returns false for "unpaid"', () => {
    expect(isEntitledStatus('unpaid')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEntitledStatus('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEntitledStatus(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isEntitledStatus(undefined)).toBe(false);
  });

  it('returns false for an unknown string', () => {
    expect(isEntitledStatus('not-a-status')).toBe(false);
  });
});

describe('ENTITLED_SUBSCRIPTION_STATUSES', () => {
  it('is a subset of SUBSCRIPTION_STATUSES', () => {
    const all = new Set<string>(SUBSCRIPTION_STATUSES);
    ENTITLED_SUBSCRIPTION_STATUSES.forEach((status) => {
      expect(all.has(status)).toBe(true);
    });
  });
});
