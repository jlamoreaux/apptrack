import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed, self-contained tokens for one-click waitlist joins from email links.
 *
 * The token encodes the recipient's email and an HMAC signature, so a link like
 * `/career?t=<token>` identifies the recipient without a raw email in the URL
 * and without the server having to trust a client-supplied address. The HMAC
 * (server secret) is what matters: an attacker cannot forge a valid token for
 * an email they don't control, so they cannot register someone else.
 */
const TOKEN_SECRET =
  process.env.WAITLIST_TOKEN_SECRET ||
  process.env.UNSUBSCRIBE_SECRET ||
  process.env.CRON_SECRET ||
  "fallback-secret-change-me";

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function generateWaitlistToken(email: string): string {
  const payload = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the normalized email if the token is authentic, else null. */
export function verifyWaitlistToken(token: unknown): string | null {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    // Length mismatch throws in timingSafeEqual — treat as invalid.
    return null;
  }

  try {
    const email = Buffer.from(payload, "base64url").toString("utf8");
    return email.length > 0 ? email : null;
  } catch {
    return null;
  }
}
