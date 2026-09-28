/** Request helpers shared by route handlers that read bodies and key limits by IP. */

import { MS_PER_SECOND } from "@/lib/constants/dates";

const UNKNOWN_IP = "unknown";
const MIN_RETRY_AFTER_SECONDS = 1;

const IPV6_SEPARATOR = ":";
const IPV6_COMPRESSION = "::";
const IPV6_HEXTET_COUNT = 8;
const IPV6_PREFIX_64_HEXTETS = 4;
const IPV6_HEXTET_PATTERN = /^[0-9a-f]{1,4}$/;
const IPV6_ZONE_ID = /%.*$/;
const IPV6_BRACKETS = /^\[(.*)\]$/;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV4_MAPPED_PREFIX = ["0", "0", "0", "0", "0", "ffff"];
// An embedded IPv4 address fills the last two hextets.
const IPV4_HEXTETS = 2;
const OCTET_MAX = 255;
const BITS_PER_OCTET = 8;
const OCTET_MASK = 0xff;
const HEX_RADIX = 16;

/** What readBodyWithinLimit read, or why it couldn't. */
export type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "unreadable" };

/** The Content-Length header as a number; 0 when absent or not a number. */
function declaredContentLength(request: Request): number {
  const header = request.headers.get("content-length");
  const length = header === null ? 0 : Number(header);
  return Number.isFinite(length) ? length : 0;
}

/** Reads the stream as UTF-8, or returns null as soon as it exceeds maxBytes. */
async function readCappedText(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<string | null> {
  if (stream === null) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * The body text when both the declared and the actual size fit maxBytes.
 * `unreadable` when the stream fails midway (usually the client went away),
 * which the caller answers with a 400 rather than letting it surface as a 500.
 */
export async function readBodyWithinLimit(
  request: Request,
  maxBytes: number
): Promise<BodyReadResult> {
  if (declaredContentLength(request) > maxBytes) return { ok: false, reason: "too_large" };
  try {
    const text = await readCappedText(request.body, maxBytes);
    return text === null ? { ok: false, reason: "too_large" } : { ok: true, text };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/** The client IP from the platform's forwarding headers, for rate-limit keys. */
export function clientIp(headers: Headers): string {
  const forwardedFirstHop = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFirstHop || headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
}

/** The eight hextets of an IPv6 address, or null when it isn't one. */
function ipv6Hextets(address: string): string[] | null {
  const halves = address.split(IPV6_COMPRESSION);
  if (halves.length > 2) return null;
  const splitHalf = (half: string): string[] => (half === "" ? [] : half.split(IPV6_SEPARATOR));
  const head = splitHalf(halves[0]);
  const tail = halves.length === 2 ? splitHalf(halves[1]) : [];

  // A trailing dotted IPv4 part stands for two hextets.
  const groups = tail.length > 0 ? tail : head;
  const last = groups[groups.length - 1];
  if (last !== undefined && IPV4_PATTERN.test(last)) {
    const octets = last.split(".").map(Number);
    if (octets.some((octet) => octet > OCTET_MAX)) return null;
    groups.splice(
      groups.length - 1,
      1,
      ((octets[0] << BITS_PER_OCTET) | octets[1]).toString(HEX_RADIX),
      ((octets[2] << BITS_PER_OCTET) | octets[3]).toString(HEX_RADIX)
    );
  }

  const missing = IPV6_HEXTET_COUNT - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const hextets = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (!hextets.every((hextet) => IPV6_HEXTET_PATTERN.test(hextet))) return null;
  return hextets.map((hextet) => parseInt(hextet, HEX_RADIX).toString(HEX_RADIX));
}

/**
 * The key to rate-limit an IP by: an IPv6 address becomes its /64 (one
 * subscriber's allocation, so rotating addresses within it doesn't buy new
 * quota), an IPv4-mapped IPv6 address becomes the IPv4 address, and anything
 * else, IPv4 included, is returned as is.
 */
export function rateLimitIpKey(ip: string): string {
  if (!ip.includes(IPV6_SEPARATOR)) return ip;
  const address = ip.trim().replace(IPV6_BRACKETS, "$1").replace(IPV6_ZONE_ID, "").toLowerCase();
  const hextets = ipv6Hextets(address);
  if (hextets === null) return ip;
  const isIpv4Mapped = IPV4_MAPPED_PREFIX.every((hextet, index) => hextets[index] === hextet);
  if (isIpv4Mapped) {
    return hextets
      .slice(IPV6_HEXTET_COUNT - IPV4_HEXTETS)
      .flatMap((hextet) => {
        const value = parseInt(hextet, HEX_RADIX);
        return [value >> BITS_PER_OCTET, value & OCTET_MASK];
      })
      .join(".");
  }
  return `${hextets.slice(0, IPV6_PREFIX_64_HEXTETS).join(IPV6_SEPARATOR)}::/64`;
}

/**
 * Whole seconds until `resetMs` (epoch ms) from `nowMs`, rounded up and at
 * least 1, for a Retry-After header.
 */
export function retryAfterSeconds(resetMs: number, nowMs: number): number {
  return Math.max(Math.ceil((resetMs - nowMs) / MS_PER_SECOND), MIN_RETRY_AFTER_SECONDS);
}
