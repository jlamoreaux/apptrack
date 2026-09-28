// @jest-environment node
/**
 * Tests for lib/auth/oauth/pkce.ts:
 * - the RFC 7636 appendix B vector passes
 * - a wrong verifier, a short or long verifier, and a bad charset fail
 * - a malformed stored challenge fails without throwing
 */

import { isValidCodeVerifier, s256Challenge, verifyPkceS256 } from "@/lib/auth/oauth/pkce";
import { AGENT_OAUTH_PKCE } from "@/lib/constants/agent-oauth";

// RFC 7636 appendix B.
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("S256", () => {
  it("matches the RFC 7636 appendix B vector", () => {
    expect(s256Challenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
    expect(verifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true);
  });

  it("fails for a wrong verifier", () => {
    expect(verifyPkceS256(`${RFC_VERIFIER.slice(0, -1)}l`, RFC_CHALLENGE)).toBe(false);
  });

  it("fails for a challenge differing only in its last character", () => {
    expect(verifyPkceS256(RFC_VERIFIER, `${RFC_CHALLENGE.slice(0, -1)}N`)).toBe(false);
  });

  it.each(["", "short", "E9Melhoa2Owv", "x".repeat(200)])(
    "fails without throwing for the malformed stored challenge %j",
    (challenge) => {
      expect(() => verifyPkceS256(RFC_VERIFIER, challenge)).not.toThrow();
      expect(verifyPkceS256(RFC_VERIFIER, challenge)).toBe(false);
    }
  );
});

describe("verifier format", () => {
  it.each([
    ["the minimum length", "a".repeat(AGENT_OAUTH_PKCE.verifierMinLength)],
    ["the maximum length", "a".repeat(AGENT_OAUTH_PKCE.verifierMaxLength)],
    ["every unreserved character", `${"Az09-._~".repeat(6)}`],
  ])("accepts %s", (_label, verifier) => {
    expect(isValidCodeVerifier(verifier)).toBe(true);
  });

  it.each([
    ["one character short", "a".repeat(AGENT_OAUTH_PKCE.verifierMinLength - 1)],
    ["one character long", "a".repeat(AGENT_OAUTH_PKCE.verifierMaxLength + 1)],
    ["a space", `${"a".repeat(42)} `],
    ["a plus sign", `${"a".repeat(42)}+`],
    ["a slash", `${"a".repeat(42)}/`],
    ["a non-ASCII letter", `${"a".repeat(42)}é`],
  ])("rejects %s", (_label, verifier) => {
    expect(isValidCodeVerifier(verifier)).toBe(false);
    expect(verifyPkceS256(verifier, s256Challenge(verifier))).toBe(false);
  });
});
