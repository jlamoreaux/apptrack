/**
 * PKCE (RFC 7636) verification at the token endpoint. Only S256 is supported:
 * the challenge stored with the code is base64url(SHA-256(code_verifier)).
 */

import { createHash } from "crypto";
import { digestsEqual } from "@/lib/auth/prefixed-secret";
import { AGENT_OAUTH_PKCE } from "@/lib/constants/agent-oauth";

// RFC 7636 §4.1: unreserved characters, 43 to 128 of them.
const CODE_VERIFIER_PATTERN = new RegExp(
  `^[A-Za-z0-9\\-._~]{${AGENT_OAUTH_PKCE.verifierMinLength},${AGENT_OAUTH_PKCE.verifierMaxLength}}$`
);

/** True when `verifier` has the RFC 7636 §4.1 charset and length. */
export function isValidCodeVerifier(verifier: string): boolean {
  return CODE_VERIFIER_PATTERN.test(verifier);
}

/** The S256 challenge for `verifier`: base64url(SHA-256(ASCII(verifier))). */
export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/**
 * True when `verifier` is well formed and its S256 challenge equals
 * `storedChallenge`, compared timing-safely (digestsEqual), so a malformed
 * stored value simply doesn't match.
 */
export function verifyPkceS256(verifier: string, storedChallenge: string): boolean {
  if (!isValidCodeVerifier(verifier)) return false;
  return digestsEqual(s256Challenge(verifier), storedChallenge);
}
