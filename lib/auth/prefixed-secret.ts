/**
 * Prefixed secrets: personal access tokens (`co_pat_`) and the OAuth access
 * tokens, refresh tokens, authorization codes and client secrets.
 *
 * Format: prefix + base64url(32 random bytes) + `_` + checksum, where the
 * checksum is the CRC32 of everything before the final underscore, in base36.
 * The checksum lets a caller reject typos and junk without a database query,
 * and makes leaked secrets recognizable to secret scanners. It is public, so
 * it proves nothing about authenticity.
 *
 * Only the SHA-256 hex digest is ever stored.
 */

import { createHash, randomBytes } from "crypto";
import {
  AGENT_TOKEN_CHECKSUM_LENGTH,
  AGENT_TOKEN_SECRET_BYTES,
} from "@/lib/constants/agent-access";

/** A freshly minted secret. `raw` is handed out once and never stored. */
export interface GeneratedSecret {
  raw: string;
  hash: string;
}

const BASE36_RADIX = 36;
const CHECKSUM_SEPARATOR = "_";
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

// base64url without padding: 4 characters per 3 bytes, rounded up.
const SECRET_LENGTH = Math.ceil((AGENT_TOKEN_SECRET_BYTES * 4) / 3);

// Standard (IEEE 802.3, reflected) CRC32. Implemented here because the
// installed Node typings predate zlib.crc32.
const CRC32_POLYNOMIAL = 0xedb88320;
const CRC32_INITIAL = 0xffffffff;
const BYTE_VALUE_COUNT = 256;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const CRC32_TABLE = buildCrc32Table();

const formatPatterns = new Map<string, RegExp>();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(BYTE_VALUE_COUNT);
  for (let n = 0; n < table.length; n++) {
    let crc = n;
    for (let bit = 0; bit < BITS_PER_BYTE; bit++) {
      crc = crc & 1 ? CRC32_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
    }
    table[n] = crc >>> 0;
  }
  return table;
}

function crc32(text: string): number {
  let crc = CRC32_INITIAL;
  for (const byte of Buffer.from(text, "utf8")) {
    crc = CRC32_TABLE[(crc ^ byte) & BYTE_MASK] ^ (crc >>> BITS_PER_BYTE);
  }
  return (crc ^ CRC32_INITIAL) >>> 0;
}

function checksumOf(body: string): string {
  return crc32(body)
    .toString(BASE36_RADIX)
    .padStart(AGENT_TOKEN_CHECKSUM_LENGTH, "0");
}

function formatPattern(prefix: string): RegExp {
  const cached = formatPatterns.get(prefix);
  if (cached) return cached;
  const escapedPrefix = prefix.replace(REGEX_SPECIAL_CHARACTERS, "\\$&");
  const pattern = new RegExp(
    `^${escapedPrefix}[A-Za-z0-9_-]{${SECRET_LENGTH}}${CHECKSUM_SEPARATOR}[0-9a-z]{${AGENT_TOKEN_CHECKSUM_LENGTH}}$`
  );
  formatPatterns.set(prefix, pattern);
  return pattern;
}

/** SHA-256 hex of the full raw secret, as stored in the database. */
export function hashSecret(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Mint a new secret with `prefix`. Store only `hash`; hand out `raw` once. */
export function generatePrefixedSecret(prefix: string): GeneratedSecret {
  const body = prefix + randomBytes(AGENT_TOKEN_SECRET_BYTES).toString("base64url");
  const raw = `${body}${CHECKSUM_SEPARATOR}${checksumOf(body)}`;
  return { raw, hash: hashSecret(raw) };
}

/**
 * True when `raw` has the shape of a secret with `prefix` and a matching
 * checksum. No database access.
 */
export function hasValidPrefixedSecretFormat(raw: unknown, prefix: string): raw is string {
  if (typeof raw !== "string" || !formatPattern(prefix).test(raw)) return false;
  const separatorIndex = raw.lastIndexOf(CHECKSUM_SEPARATOR);
  return checksumOf(raw.slice(0, separatorIndex)) === raw.slice(separatorIndex + 1);
}
