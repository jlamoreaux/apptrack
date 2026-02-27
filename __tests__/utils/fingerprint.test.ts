/**
 * Tests for lib/utils/fingerprint.ts
 * Browser fingerprinting and client IP extraction
 *
 * Note: SSR path (window=undefined) tested in fingerprint.ssr.test.ts (node env)
 */

// @jest-environment jsdom

import { getFingerprint, getClientIP } from '@/lib/utils/fingerprint';

// Helper to create a Request-like object with specific headers
function makeRequest(headers: Record<string, string | undefined>): Request {
  const headerMap = new Map(
    Object.entries(headers).filter(([, v]) => v !== undefined) as [string, string][]
  );
  return {
    headers: {
      get: (key: string) => headerMap.get(key.toLowerCase()) ?? null,
    },
  } as unknown as Request;
}

describe('getClientIP', () => {
  it('returns first IP from x-forwarded-for header', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('returns x-forwarded-for when only single IP present', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.5' });
    expect(getClientIP(req)).toBe('203.0.113.5');
  });

  it('trims whitespace from x-forwarded-for IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '192.168.1.1' });
    expect(getClientIP(req)).toBe('192.168.1.1');
  });

  it('falls back to cf-connecting-ip when others are absent', () => {
    const req = makeRequest({ 'cf-connecting-ip': '172.16.0.5' });
    expect(getClientIP(req)).toBe('172.16.0.5');
  });

  it('returns "unknown" when all IP headers are missing', () => {
    const req = makeRequest({});
    expect(getClientIP(req)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '192.168.0.1',
    });
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('prefers x-real-ip over cf-connecting-ip', () => {
    const req = makeRequest({
      'x-real-ip': '192.168.0.1',
      'cf-connecting-ip': '172.16.0.5',
    });
    expect(getClientIP(req)).toBe('192.168.0.1');
  });
});

describe('getFingerprint (browser context)', () => {
  it('returns a string in browser context (window defined)', async () => {
    // In jsdom, window is defined
    const result = await getFingerprint();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string (not the SSR fallback)', async () => {
    const result = await getFingerprint();
    expect(result).not.toBe('');
    // In browser context, should NOT return the SSR fallback
    expect(result).not.toBe('server-side-render');
  });

  it('returns consistent result for same browser context', async () => {
    // navigator.userAgent is fixed in jsdom, so fingerprint should be consistent
    const result1 = await getFingerprint();
    const result2 = await getFingerprint();
    expect(result1).toBe(result2);
  });
});
