import { createHash, createHmac } from "crypto";

/**
 * Server-only secret used to key the email hash. A dedicated
 * ANALYTICS_HASH_SECRET is preferred; it falls back to CRON_SECRET, which every
 * real environment already sets (crons + the validation-email route depend on
 * it). Never expose this to the client.
 */
function getHashSecret(): string | undefined {
  return process.env.ANALYTICS_HASH_SECRET || process.env.CRON_SECRET || undefined;
}

/**
 * Derive a stable, non-reversible analytics distinct id from an email address.
 *
 * Used server-side when no user_id is available, so PostHog never stores the
 * raw email as an identifier while still giving each recipient a deterministic
 * per-email id for counting and cross-event stitching.
 *
 * Keyed with a server secret (HMAC-SHA-256) so the mapping can't be reversed by
 * brute-forcing low-entropy email addresses against the published distinct ids.
 * If no secret is configured (local dev only), it degrades to an unkeyed
 * SHA-256 rather than a hardcoded key, so a misconfiguration never silently
 * weakens hashing to a shared, guessable secret.
 */
export function emailDistinctId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const secret = getHashSecret();
  const digest = secret
    ? createHmac("sha256", secret).update(normalized).digest("hex")
    : createHash("sha256").update(normalized).digest("hex");
  return `email_${digest}`;
}
