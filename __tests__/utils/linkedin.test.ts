/**
 * Tests for lib/utils/linkedin.ts
 * LinkedIn URL parsing and profile utilities
 */

// @jest-environment node

import {
  parseLinkedInUrl,
  isValidLinkedInUrl,
  formatLinkedInUrl,
  extractProfileInfoFromUrl,
  getInitialsFromName,
} from '@/lib/utils/linkedin';

// ---------------------------------------------------------------------------
// parseLinkedInUrl
// ---------------------------------------------------------------------------
describe('parseLinkedInUrl', () => {
  it('extracts username from a standard LinkedIn /in/ URL', () => {
    expect(parseLinkedInUrl('https://www.linkedin.com/in/johndoe')).toBe('johndoe');
  });

  it('handles URL with trailing slash', () => {
    expect(parseLinkedInUrl('https://www.linkedin.com/in/johndoe/')).toBe('johndoe');
  });

  it('handles URL without www subdomain', () => {
    expect(parseLinkedInUrl('https://linkedin.com/in/johndoe')).toBe('johndoe');
  });

  it('handles URL with subpath beyond /in/username', () => {
    expect(
      parseLinkedInUrl('https://www.linkedin.com/in/johndoe/details/experience/')
    ).toBe('johndoe');
  });

  it('returns null for a non-LinkedIn URL', () => {
    expect(parseLinkedInUrl('https://example.com/in/johndoe')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseLinkedInUrl('')).toBeNull();
  });

  it('returns null for a company LinkedIn URL (no /in/ segment)', () => {
    expect(parseLinkedInUrl('https://www.linkedin.com/company/acme-corp')).toBeNull();
  });

  it('handles hyphenated usernames', () => {
    expect(parseLinkedInUrl('https://www.linkedin.com/in/john-doe-phd')).toBe('john-doe-phd');
  });
});

// ---------------------------------------------------------------------------
// isValidLinkedInUrl
// ---------------------------------------------------------------------------
describe('isValidLinkedInUrl', () => {
  it('returns true for a valid /in/ profile URL', () => {
    expect(isValidLinkedInUrl('https://www.linkedin.com/in/johndoe')).toBe(true);
  });

  it('returns true for a URL without www', () => {
    expect(isValidLinkedInUrl('https://linkedin.com/in/johndoe')).toBe(true);
  });

  it('returns false for a company page URL', () => {
    expect(isValidLinkedInUrl('https://www.linkedin.com/company/acme-corp')).toBe(false);
  });

  it('returns false for a non-LinkedIn URL that contains /in/', () => {
    expect(isValidLinkedInUrl('https://example.com/in/johndoe')).toBe(false);
  });

  it('returns false for a plain string (not a URL)', () => {
    expect(isValidLinkedInUrl('johndoe')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidLinkedInUrl('')).toBe(false);
  });

  it('returns false for a URL with no pathname at all', () => {
    expect(isValidLinkedInUrl('https://www.linkedin.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatLinkedInUrl
// ---------------------------------------------------------------------------
describe('formatLinkedInUrl', () => {
  it('normalises a URL with trailing slash to canonical form', () => {
    expect(formatLinkedInUrl('https://www.linkedin.com/in/johndoe/')).toBe(
      'https://www.linkedin.com/in/johndoe'
    );
  });

  it('normalises a URL with extra sub-paths to canonical form', () => {
    expect(
      formatLinkedInUrl('https://www.linkedin.com/in/johndoe/details/experience/')
    ).toBe('https://www.linkedin.com/in/johndoe');
  });

  it('normalises a URL without www to canonical form', () => {
    expect(formatLinkedInUrl('https://linkedin.com/in/johndoe')).toBe(
      'https://www.linkedin.com/in/johndoe'
    );
  });

  it('returns the original string unchanged when it is not a LinkedIn /in/ URL', () => {
    const nonLinkedIn = 'https://example.com/profile';
    expect(formatLinkedInUrl(nonLinkedIn)).toBe(nonLinkedIn);
  });
});

// ---------------------------------------------------------------------------
// extractProfileInfoFromUrl
// ---------------------------------------------------------------------------
describe('extractProfileInfoFromUrl', () => {
  it('extracts username from a valid LinkedIn URL', () => {
    const result = extractProfileInfoFromUrl('https://www.linkedin.com/in/johndoe');
    expect(result.username).toBe('johndoe');
  });

  it('generates a suggested name from a simple username', () => {
    const result = extractProfileInfoFromUrl('https://www.linkedin.com/in/johndoe');
    expect(result.suggestedName).toBe('Johndoe');
  });

  it('converts a hyphenated username to a spaced, capitalised name', () => {
    const result = extractProfileInfoFromUrl('https://www.linkedin.com/in/john-doe');
    expect(result.suggestedName).toBe('John Doe');
  });

  it('uppercases known professional suffixes in the suggested name', () => {
    const result = extractProfileInfoFromUrl('https://www.linkedin.com/in/jane-smith-phd');
    expect(result.suggestedName).toBe('Jane Smith PHD');
  });

  it('returns nulls for a non-LinkedIn URL', () => {
    const result = extractProfileInfoFromUrl('https://example.com/profile/johndoe');
    expect(result).toEqual({ username: null, suggestedName: null });
  });

  it('returns nulls for an empty string', () => {
    const result = extractProfileInfoFromUrl('');
    expect(result).toEqual({ username: null, suggestedName: null });
  });
});

// ---------------------------------------------------------------------------
// getInitialsFromName
// ---------------------------------------------------------------------------
describe('getInitialsFromName', () => {
  it('returns first letters of first and last name for a two-word name', () => {
    expect(getInitialsFromName('John Doe')).toBe('JD');
  });

  it('uses first two characters for a single-word name', () => {
    expect(getInitialsFromName('John')).toBe('JO');
  });

  it('returns the fallback "LP" for null input', () => {
    expect(getInitialsFromName(null)).toBe('LP');
  });

  it('returns the fallback "LP" for undefined input', () => {
    expect(getInitialsFromName(undefined)).toBe('LP');
  });

  it('returns the fallback "LP" for an empty string', () => {
    expect(getInitialsFromName('')).toBe('LP');
  });

  it('uses first and last name letters for a three-word name', () => {
    expect(getInitialsFromName('Mary Jane Watson')).toBe('MW');
  });

  it('handles extra whitespace gracefully', () => {
    expect(getInitialsFromName('  Alice   Bob  ')).toBe('AB');
  });

  it('returns uppercase initials', () => {
    expect(getInitialsFromName('alice bob')).toBe('AB');
  });
});
