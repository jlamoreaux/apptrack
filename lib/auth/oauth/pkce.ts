/**
 * PKCE (RFC 7636) verification at the token endpoint. Only S256 is supported:
 * the challenge stored with the code is base64url(SHA-256(code_verifier)).
 */

import { createHash, timingSafeEqual } from "crypto";
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

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * True when `verifier` is well formed and its S256 challenge equals
 * `storedChallenge`. The two challenge strings are compared as SHA-256
 * digests, which always have the same length, so timingSafeEqual never throws
 * and a malformed stored value simply doesn't match.
 */
export function verifyPkceS256(verifier: string, storedChallenge: string): boolean {
  if (!isValidCodeVerifier(verifier)) return false;
  return timingSafeEqual(sha256(s256Challenge(verifier)), sha256(storedChallenge));
}
