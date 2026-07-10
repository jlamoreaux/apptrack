import { createHash } from "crypto";

/**
 * Derive a stable, non-reversible analytics distinct id from an email address.
 *
 * Used server-side when no user_id is available, so PostHog never stores the
 * raw email as an identifier (a PII exposure) while still giving each recipient
 * a deterministic per-email id for counting and cross-event stitching.
 */
export function emailDistinctId(email: string): string {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  return `email_${hash}`;
}
