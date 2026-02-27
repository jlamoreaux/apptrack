/**
 * Tests for lib/utils/api-validation.ts
 * UUID validation utilities
 */

// @jest-environment node

import { isValidUUID, validateUUIDParam } from '@/lib/utils/api-validation';

describe('isValidUUID', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for UUID with uppercase letters', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('returns true for all-lowercase valid UUID', () => {
    expect(isValidUUID('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('returns false for "not-a-uuid"', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('returns false for UUID with invalid character (Z)', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000Z')).toBe(false);
  });

  it('returns false for UUID without dashes', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('returns false for UUID with wrong segment lengths', () => {
    expect(isValidUUID('550e84-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isValidUUID('12345')).toBe(false);
  });
});

describe('validateUUIDParam', () => {
  it('resolves with the valid UUID', async () => {
    const validId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await validateUUIDParam(Promise.resolve({ id: validId }));
    expect(result).toBe(validId);
  });

  it('throws Error with "Invalid UUID format" for invalid input', async () => {
    await expect(
      validateUUIDParam(Promise.resolve({ id: 'not-a-uuid' }))
    ).rejects.toThrow('Invalid UUID format');
  });

  it('throws for empty string id', async () => {
    await expect(
      validateUUIDParam(Promise.resolve({ id: '' }))
    ).rejects.toThrow('Invalid UUID format');
  });

  it('throws for id without dashes', async () => {
    await expect(
      validateUUIDParam(Promise.resolve({ id: '550e8400e29b41d4a716446655440000' }))
    ).rejects.toThrow('Invalid UUID format');
  });
});
