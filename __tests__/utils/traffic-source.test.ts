/**
 * Tests for lib/utils/traffic-source.ts
 * Traffic source parsing and storage utilities
 */

// @jest-environment jsdom

import {
  parseTrafficSource,
  getTrafficSourceTrial,
  hasTrialOffer,
  formatTrafficSource,
  storeTrafficSource,
  getStoredTrafficSource,
  clearTrafficSource,
} from '@/lib/utils/traffic-source';

describe('parseTrafficSource', () => {
  it('returns null for null input', () => {
    expect(parseTrafficSource(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTrafficSource('')).toBeNull();
  });

  it('parses "reddit" correctly', () => {
    expect(parseTrafficSource('reddit')).toBe('reddit');
  });

  it('handles case-insensitive input (REDDIT)', () => {
    expect(parseTrafficSource('REDDIT')).toBe('reddit');
  });

  it('maps abbreviation "r" to "reddit"', () => {
    expect(parseTrafficSource('r')).toBe('reddit');
  });

  it('maps abbreviation "fb" to "facebook"', () => {
    expect(parseTrafficSource('fb')).toBe('facebook');
  });

  it('maps abbreviation "li" to "linkedin"', () => {
    expect(parseTrafficSource('li')).toBe('linkedin');
  });

  it('maps abbreviation "tw" to "twitter"', () => {
    expect(parseTrafficSource('tw')).toBe('twitter');
  });

  it('maps abbreviation "g" to "google"', () => {
    expect(parseTrafficSource('g')).toBe('google');
  });

  it('returns "other" for completely unrecognized source', () => {
    expect(parseTrafficSource('unknown-source-xyz')).toBe('other');
  });

  it('parses "linkedin" correctly', () => {
    expect(parseTrafficSource('linkedin')).toBe('linkedin');
  });

  it('parses "twitter" correctly', () => {
    expect(parseTrafficSource('twitter')).toBe('twitter');
  });

  it('parses "facebook" correctly', () => {
    expect(parseTrafficSource('facebook')).toBe('facebook');
  });

  it('parses "google" correctly', () => {
    expect(parseTrafficSource('google')).toBe('google');
  });
});

describe('getTrafficSourceTrial', () => {
  it('returns a trial object for "reddit"', () => {
    const trial = getTrafficSourceTrial('reddit');
    expect(trial).not.toBeNull();
    expect(trial?.days).toBe(7);
    expect(trial?.type).toBe('ai_coach_trial');
    expect(trial?.source).toBe('reddit');
  });

  it('returns a trial object for "linkedin"', () => {
    const trial = getTrafficSourceTrial('linkedin');
    expect(trial).not.toBeNull();
    expect(trial?.days).toBe(7);
    expect(trial?.source).toBe('linkedin');
  });

  it('returns null for "twitter" (no trial)', () => {
    expect(getTrafficSourceTrial('twitter')).toBeNull();
  });

  it('returns null for "facebook" (no trial)', () => {
    expect(getTrafficSourceTrial('facebook')).toBeNull();
  });

  it('returns null for "google" (no trial)', () => {
    expect(getTrafficSourceTrial('google')).toBeNull();
  });

  it('returns null for "other" (no trial)', () => {
    expect(getTrafficSourceTrial('other')).toBeNull();
  });
});

describe('hasTrialOffer', () => {
  it('returns true for "reddit"', () => {
    expect(hasTrialOffer('reddit')).toBe(true);
  });

  it('returns true for "linkedin"', () => {
    expect(hasTrialOffer('linkedin')).toBe(true);
  });

  it('returns false for "twitter"', () => {
    expect(hasTrialOffer('twitter')).toBe(false);
  });

  it('returns false for "facebook"', () => {
    expect(hasTrialOffer('facebook')).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasTrialOffer(null)).toBe(false);
  });

  it('returns false for "google"', () => {
    expect(hasTrialOffer('google')).toBe(false);
  });
});

describe('formatTrafficSource', () => {
  it('formats "linkedin" as "LinkedIn"', () => {
    expect(formatTrafficSource('linkedin')).toBe('LinkedIn');
  });

  it('formats "reddit" as "Reddit"', () => {
    expect(formatTrafficSource('reddit')).toBe('Reddit');
  });

  it('formats "twitter" as "Twitter"', () => {
    expect(formatTrafficSource('twitter')).toBe('Twitter');
  });

  it('formats "facebook" as "Facebook"', () => {
    expect(formatTrafficSource('facebook')).toBe('Facebook');
  });

  it('formats "google" as "Google"', () => {
    expect(formatTrafficSource('google')).toBe('Google');
  });

  it('formats "other" as "Other"', () => {
    expect(formatTrafficSource('other')).toBe('Other');
  });
});

describe('storeTrafficSource + getStoredTrafficSource + clearTrafficSource', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and retrieves traffic source', () => {
    storeTrafficSource('reddit');
    const result = getStoredTrafficSource();
    expect(result.source).toBe('reddit');
  });

  it('stores and retrieves trial data', () => {
    const trial = { days: 7, type: 'ai_coach_trial' as const, source: 'reddit' as const };
    storeTrafficSource('reddit', trial);
    const result = getStoredTrafficSource();
    expect(result.trial).toEqual(trial);
  });

  it('returns null values when nothing is stored', () => {
    const result = getStoredTrafficSource();
    expect(result.source).toBeNull();
    expect(result.trial).toBeNull();
    expect(result.timestamp).toBeNull();
  });

  it('stores timestamp when storing traffic source', () => {
    storeTrafficSource('linkedin');
    const result = getStoredTrafficSource();
    expect(result.timestamp).not.toBeNull();
    // Should be a valid ISO date
    expect(new Date(result.timestamp!).toISOString()).toBeTruthy();
  });

  it('clears all traffic source data', () => {
    storeTrafficSource('reddit', { days: 7, type: 'ai_coach_trial', source: 'reddit' });
    clearTrafficSource();
    const result = getStoredTrafficSource();
    expect(result.source).toBeNull();
    expect(result.trial).toBeNull();
    expect(result.timestamp).toBeNull();
  });
});
