/**
 * Tests for lib/constants/application-status.ts
 * Application status type guards and helpers
 */

// @jest-environment node

import {
  APPLICATION_STATUS,
  APPLICATION_STATUS_VALUES,
  isApplicationStatus,
  assertApplicationStatus,
  isValidStatus,
  getStatusOptions,
  getStatusConfig,
} from '@/lib/constants/application-status';

describe('APPLICATION_STATUS_VALUES', () => {
  it('has exactly 6 entries', () => {
    expect(APPLICATION_STATUS_VALUES).toHaveLength(6);
  });

  it('contains all expected status values', () => {
    expect(APPLICATION_STATUS_VALUES).toContain('Applied');
    expect(APPLICATION_STATUS_VALUES).toContain('Interview Scheduled');
    expect(APPLICATION_STATUS_VALUES).toContain('Interviewed');
    expect(APPLICATION_STATUS_VALUES).toContain('Offer');
    expect(APPLICATION_STATUS_VALUES).toContain('Hired');
    expect(APPLICATION_STATUS_VALUES).toContain('Rejected');
  });
});

describe('isApplicationStatus', () => {
  it('returns true for "Applied"', () => {
    expect(isApplicationStatus('Applied')).toBe(true);
  });

  it('returns true for "Interview Scheduled"', () => {
    expect(isApplicationStatus('Interview Scheduled')).toBe(true);
  });

  it('returns true for "Interviewed"', () => {
    expect(isApplicationStatus('Interviewed')).toBe(true);
  });

  it('returns true for "Offer"', () => {
    expect(isApplicationStatus('Offer')).toBe(true);
  });

  it('returns true for "Hired"', () => {
    expect(isApplicationStatus('Hired')).toBe(true);
  });

  it('returns true for "Rejected"', () => {
    expect(isApplicationStatus('Rejected')).toBe(true);
  });

  it('returns false for "InvalidStatus"', () => {
    expect(isApplicationStatus('InvalidStatus')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isApplicationStatus(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isApplicationStatus(null)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isApplicationStatus(42)).toBe(false);
  });

  it('returns false for lowercase "applied"', () => {
    expect(isApplicationStatus('applied')).toBe(false);
  });
});

describe('assertApplicationStatus', () => {
  it('does not throw for "Applied"', () => {
    expect(() => assertApplicationStatus('Applied')).not.toThrow();
  });

  it('does not throw for any valid status', () => {
    APPLICATION_STATUS_VALUES.forEach(status => {
      expect(() => assertApplicationStatus(status)).not.toThrow();
    });
  });

  it('throws for "invalid" status', () => {
    expect(() => assertApplicationStatus('invalid')).toThrow();
  });

  it('throws with a descriptive message for invalid status', () => {
    expect(() => assertApplicationStatus('foobar')).toThrow(/foobar/);
  });

  it('throws for undefined', () => {
    expect(() => assertApplicationStatus(undefined)).toThrow();
  });
});

describe('isValidStatus', () => {
  it('returns true for "Rejected"', () => {
    expect(isValidStatus('Rejected')).toBe(true);
  });

  it('returns true for all valid statuses', () => {
    APPLICATION_STATUS_VALUES.forEach(status => {
      expect(isValidStatus(status)).toBe(true);
    });
  });

  it('returns false for invalid string', () => {
    expect(isValidStatus('Pending')).toBe(false);
  });
});

describe('getStatusOptions', () => {
  it('returns an array of options', () => {
    const options = getStatusOptions();
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBe(6);
  });

  it('returns options sorted by order property', () => {
    const options = getStatusOptions();
    for (let i = 1; i < options.length; i++) {
      expect(options[i].order).toBeGreaterThan(options[i - 1].order);
    }
  });

  it('each option has required fields', () => {
    const options = getStatusOptions();
    options.forEach(opt => {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('order');
      expect(opt).toHaveProperty('colors');
    });
  });
});

describe('getStatusConfig', () => {
  it('returns config with bg, text, border, label for "Applied"', () => {
    const config = getStatusConfig('Applied');
    expect(config).toHaveProperty('bg');
    expect(config).toHaveProperty('text');
    expect(config).toHaveProperty('border');
    expect(config).toHaveProperty('label');
  });

  it('returns config for all valid statuses', () => {
    APPLICATION_STATUS_VALUES.forEach(status => {
      expect(() => getStatusConfig(status)).not.toThrow();
      const config = getStatusConfig(status);
      expect(config.label).toBeTruthy();
    });
  });
});
