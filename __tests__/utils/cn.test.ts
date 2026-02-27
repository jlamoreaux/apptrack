/**
 * Tests for lib/utils/cn.ts
 * Tailwind class merging utility
 */

// @jest-environment node

import { cn } from '@/lib/utils/cn';

describe('cn', () => {
  it('joins two plain class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('deduplicates conflicting Tailwind classes (later wins)', () => {
    // tailwind-merge should resolve p-4 vs p-6
    const result = cn('p-4', 'p-6');
    expect(result).toBe('p-6');
  });

  it('handles conditional classes via object syntax', () => {
    const result = cn({ hidden: false, block: true });
    expect(result).toBe('block');
  });

  it('handles falsy values gracefully', () => {
    const result = cn('a', false, null, undefined, 'b');
    expect(result).toBe('a b');
  });

  it('handles empty call', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('merges text color classes correctly', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('does not deduplicate non-conflicting classes', () => {
    const result = cn('p-4', 'm-4');
    expect(result).toContain('p-4');
    expect(result).toContain('m-4');
  });
});
