/**
 * SSRF guards for routes that fetch user-supplied URLs.
 *
 * Shared by the onboarding job extraction and the AI Coach
 * fetch-job-description route: hostname blocklist, DNS-resolution check
 * (a public hostname can still point at an internal address), and a capped
 * body reader so a hostile server can't exhaust memory.
 */

import { lookup } from 'dns/promises';

/**
 * Reject IP addresses in loopback, private, link-local (cloud metadata), and
 * unique-local ranges. Covers IPv4, IPv6, and v4-mapped IPv6 literals.
 */
export function isBlockedIp(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const ipv4 = v4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  if (/^fe[89ab]/.test(ip)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(ip)) return true; // unique-local fc00::/7
  return false;
}

/**
 * Reject hosts that could be used for SSRF (loopback, private ranges,
 * link-local cloud metadata, or internal-only names).
 */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return true;
  }
  return isBlockedIp(host);
}

/**
 * Resolve a hostname and reject it if any resolved address is private —
 * a public name can still point at an internal address (DNS rebinding).
 * Resolution failures are ignored so the subsequent fetch produces the
 * user-facing error.
 */
export async function assertResolvesPublic(hostname: string): Promise<void> {
  try {
    const addresses = await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true });
    if (addresses.some((entry) => isBlockedIp(entry.address))) {
      throw new Error('Blocked host');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Blocked host') throw error;
  }
}

/**
 * Read a response body as text, stopping at maxBytes so a malicious server
 * can't stream an unbounded payload.
 */
export async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    // No readable stream — still enforce the cap on whatever text() returns.
    return (await response.text()).slice(0, maxBytes);
  }

  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (bytes >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return text + decoder.decode();
}
