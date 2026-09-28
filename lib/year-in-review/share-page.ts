import { isYearInReviewEnabled } from "./gate";
import { decodeShareToken, getShareSecret, type SharePayload } from "./share-token";

/**
 * Resolves a share-page token to its payload. Null when the feature is off,
 * sharing is unconfigured, or the token is not genuine; callers 404 on null.
 */
export function resolveSharePayload(token: string): SharePayload | null {
  if (!isYearInReviewEnabled()) return null;
  const secret = getShareSecret();
  if (!secret) return null;
  // Next hands params over already decoded; base64url needs no further decoding.
  return decodeShareToken(token, secret);
}
