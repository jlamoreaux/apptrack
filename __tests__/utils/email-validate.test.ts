/**
 * Tests for lib/email/validate.ts
 * Email format validation and disposable domain blocking
 */

// @jest-environment node

import {
  isValidEmailFormat,
  isDisposableEmail,
  validateEmail,
  normalizeEmail,
  getEmailDomain,
} from '@/lib/email/validate';

describe('isValidEmailFormat', () => {
  it('returns true for a valid email', () => {
    expect(isValidEmailFormat('user@example.com')).toBe(true);
  });

  it('returns true for a short but valid email', () => {
    expect(isValidEmailFormat('a@b.co')).toBe(true);
  });

  it('returns false for "not-an-email"', () => {
    expect(isValidEmailFormat('not-an-email')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidEmailFormat('')).toBe(false);
  });

  it('returns false for email over 254 characters', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(isValidEmailFormat(longEmail)).toBe(false);
  });

  it('returns true for email with subdomain', () => {
    expect(isValidEmailFormat('user@mail.example.com')).toBe(true);
  });

  it('returns true for email with plus addressing', () => {
    expect(isValidEmailFormat('user+tag@example.com')).toBe(true);
  });

  it('returns false for email without domain', () => {
    expect(isValidEmailFormat('user@')).toBe(false);
  });

  it('returns false for email without local part', () => {
    expect(isValidEmailFormat('@example.com')).toBe(false);
  });
});

describe('isDisposableEmail', () => {
  it('returns true for mailinator.com', () => {
    expect(isDisposableEmail('user@mailinator.com')).toBe(true);
  });

  it('returns true for guerrillamail.com', () => {
    expect(isDisposableEmail('test@guerrillamail.com')).toBe(true);
  });

  it('returns true for yopmail.com', () => {
    expect(isDisposableEmail('someone@yopmail.com')).toBe(true);
  });

  it('returns false for gmail.com', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
  });

  it('returns false for outlook.com', () => {
    expect(isDisposableEmail('user@outlook.com')).toBe(false);
  });

  it('returns false for a string without @', () => {
    expect(isDisposableEmail('invalid')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDisposableEmail('')).toBe(false);
  });

  it('is case-insensitive for domain check', () => {
    expect(isDisposableEmail('user@MAILINATOR.COM')).toBe(true);
  });
});

describe('validateEmail', () => {
  it('returns valid: true for a legitimate email', () => {
    const result = validateEmail('user@gmail.com');
    expect(result.valid).toBe(true);
  });

  it('returns reason "empty" for empty string', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('returns reason "invalid_format" for bad format', () => {
    const result = validateEmail('bad-format');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_format');
  });

  it('returns reason "disposable_email" for mailinator', () => {
    const result = validateEmail('user@mailinator.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('disposable_email');
  });

  it('returns a message string with each error', () => {
    const result = validateEmail('');
    expect(typeof result.message).toBe('string');
    expect(result.message!.length).toBeGreaterThan(0);
  });

  it('handles whitespace-only string as empty', () => {
    const result = validateEmail('   ');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims the email', () => {
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
  });

  it('handles already-normalized email', () => {
    expect(normalizeEmail('user@example.com')).toBe('user@example.com');
  });
});

describe('getEmailDomain', () => {
  it('returns domain portion of email', () => {
    expect(getEmailDomain('user@example.com')).toBe('example.com');
  });

  it('returns null for invalid email', () => {
    expect(getEmailDomain('invalid')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getEmailDomain('')).toBeNull();
  });

  it('returns subdomain.domain for subdomain emails', () => {
    expect(getEmailDomain('user@mail.example.com')).toBe('mail.example.com');
  });
});
