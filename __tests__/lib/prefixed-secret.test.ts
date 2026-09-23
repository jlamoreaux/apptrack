// @jest-environment node
/**
 * Tests for lib/auth/prefixed-secret.ts: every OAuth prefix round-trips
 * through generate/check/hash, a secret never validates under another
 * prefix, the PAT wrappers produce the same format as before, and
 * base64urlLength matches Node's unpadded base64url output.
 */

import { createHash } from "crypto";
import {
  base64urlLength,
  generatePrefixedSecret,
  hashSecret,
  hasValidPrefixedSecretFormat,
} from "@/lib/auth/prefixed-secret";
import { generateAgentToken, hasValidAgentTokenFormat, hashAgentToken } from "@/lib/auth/agent-token";
import { AGENT_TOKEN_PREFIX } from "@/lib/constants/agent-access";
import { AGENT_OAUTH_PREFIXES } from "@/lib/constants/agent-oauth";

const SECRET_PREFIXES = [
  AGENT_TOKEN_PREFIX,
  AGENT_OAUTH_PREFIXES.accessToken,
  AGENT_OAUTH_PREFIXES.refreshToken,
  AGENT_OAUTH_PREFIXES.authorizationCode,
  AGENT_OAUTH_PREFIXES.clientSecret,
];

// prefix + 43 base64url characters + "_" + 7 base36 characters.
function shapeFor(prefix: string): RegExp {
  return new RegExp(`^${prefix}[A-Za-z0-9_-]{43}_[0-9a-z]{7}$`);
}

describe.each(SECRET_PREFIXES)("secrets with prefix %s", (prefix) => {
  it("round-trips: the generated secret has the shape, a valid checksum and its hash", () => {
    const { raw, hash } = generatePrefixedSecret(prefix);
    expect(raw).toMatch(shapeFor(prefix));
    expect(hasValidPrefixedSecretFormat(raw, prefix)).toBe(true);
    expect(hash).toBe(createHash("sha256").update(raw, "utf8").digest("hex"));
    expect(hashSecret(raw)).toBe(hash);
  });

  it("is rejected under every other prefix", () => {
    const { raw } = generatePrefixedSecret(prefix);
    for (const other of SECRET_PREFIXES.filter((candidate) => candidate !== prefix)) {
      expect(hasValidPrefixedSecretFormat(raw, other)).toBe(false);
    }
  });

  it("rejects a tampered checksum or body", () => {
    const { raw } = generatePrefixedSecret(prefix);
    const lastChar = raw.slice(-1) === "0" ? "1" : "0";
    expect(hasValidPrefixedSecretFormat(raw.slice(0, -1) + lastChar, prefix)).toBe(false);
    const bodyIndex = prefix.length;
    const swapped = raw[bodyIndex] === "A" ? "B" : "A";
    const tampered = raw.slice(0, bodyIndex) + swapped + raw.slice(bodyIndex + 1);
    expect(hasValidPrefixedSecretFormat(tampered, prefix)).toBe(false);
  });
});

describe("hasValidPrefixedSecretFormat", () => {
  it("rejects non-strings", () => {
    expect(hasValidPrefixedSecretFormat(undefined, AGENT_OAUTH_PREFIXES.accessToken)).toBe(false);
    expect(hasValidPrefixedSecretFormat(42, AGENT_OAUTH_PREFIXES.accessToken)).toBe(false);
  });

  it("generates distinct secrets", () => {
    const first = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken).raw;
    const second = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken).raw;
    expect(first).not.toBe(second);
  });
});

describe("PAT wrappers", () => {
  it("keep the co_pat_ format, checksum and hash", () => {
    const token = generateAgentToken();
    expect(token.raw).toMatch(shapeFor(AGENT_TOKEN_PREFIX));
    expect(hasValidAgentTokenFormat(token.raw)).toBe(true);
    expect(hasValidPrefixedSecretFormat(token.raw, AGENT_TOKEN_PREFIX)).toBe(true);
    expect(hashAgentToken(token.raw)).toBe(hashSecret(token.raw));
    expect(token.hash).toBe(hashSecret(token.raw));
  });

  it("do not accept OAuth secrets as PATs", () => {
    const access = generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken).raw;
    expect(hasValidAgentTokenFormat(access)).toBe(false);
  });
});

describe("base64urlLength", () => {
  it.each([0, 1, 2, 3, 16, 31, 32, 33])("matches the unpadded encoding of %i bytes", (bytes) => {
    expect(base64urlLength(bytes)).toBe(Buffer.alloc(bytes).toString("base64url").length);
  });
});
