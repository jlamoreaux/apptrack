import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { LABEL_IDS } from "./types";
import type { YearInReviewStats } from "./types";

/**
 * A share link carries its own data: base64url(JSON payload) + "." +
 * base64url(HMAC-SHA256). No table, so nothing to migrate, but also nothing to
 * revoke; the payload therefore holds only what the owner chose to publish.
 * Never add application-level rows or the private silence count to it.
 */

const COMPANY_MAX = 80;

const payloadSchema = z.object({
  v: z.literal(1),
  y: z.number().int().min(2000).max(2100),
  a: z.number().int().min(0),
  c: z.number().int().min(0),
  i: z.number().int().min(0),
  o: z.number().int().min(0),
  h: z.number().int().min(0),
  l: z.enum(LABEL_IDS).nullable(),
  m: z.number().int().min(0).max(11).nullable(),
  /** Company joined, only when the owner opted in. */
  hc: z.string().min(1).max(COMPANY_MAX).optional(),
});

export type SharePayload = z.infer<typeof payloadSchema>;

export interface ShareOptions {
  includeOutcome: boolean;
}

export function getShareSecret(): string | null {
  const secret = process.env.YEAR_IN_REVIEW_SHARE_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function buildSharePayload(stats: YearInReviewStats, options: ShareOptions): SharePayload {
  const payload: SharePayload = {
    v: 1,
    y: stats.year,
    a: stats.volume.applications,
    c: stats.volume.companies,
    i: stats.funnel.interviewed,
    o: stats.funnel.offers,
    h: stats.funnel.hired,
    l: stats.label,
    m: stats.volume.busiestMonth?.month ?? null,
  };
  if (options.includeOutcome && stats.outcome?.company) {
    payload.hc = stats.outcome.company.slice(0, COMPANY_MAX);
  }
  return payload;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function encodeShareToken(payload: SharePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payloadSchema.parse(payload))).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Returns the payload for a genuine token, or null for anything else. */
export function decodeShareToken(token: string, secret: string): SharePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body, secret));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
