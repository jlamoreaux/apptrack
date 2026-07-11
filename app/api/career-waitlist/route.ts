/**
 * POST /api/career-waitlist — Career Companion Phase 0 waitlist join.
 *
 * Append-only, first join wins: INSERT ... ON CONFLICT (email) DO NOTHING
 * (via upsert + ignoreDuplicates) so anonymous traffic can never mutate the
 * review_timing data the Phase 0 gate is computed from. Re-joins return
 * success (idempotent UX) but fire no analytics event, so
 * career_waitlist_joined events approximate distinct joins.
 *
 * PRD: .claude/ship/PRD.md (Deliverable 2 + 3).
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { validateEmail, normalizeEmail } from "@/lib/email/validate";
import {
  REVIEW_TIMING_OPTIONS,
  CAREER_WAITLIST_SOURCES,
  type ReviewTiming,
  type CareerWaitlistSource,
} from "@/lib/constants/career";
import { rateLimitService } from "@/lib/services/rate-limit.service";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREER_EVENT_NAMES } from "@/lib/analytics/career-event-names";
import { emailDistinctId } from "@/lib/analytics/anonymize";
import { verifyWaitlistToken } from "@/lib/career/waitlist-token";

const CAREER_WAITLIST_JOINED_EVENT = CAREER_EVENT_NAMES.WAITLIST_JOINED;

// Upstash sliding-window limit: joins per IP per hour. Kept generous because
// legitimate joiners share egress IPs (corporate NAT, campus, mobile CGNAT)
// and joins are idempotent + send no email, so the abuse blast radius is low.
// The /career form surfaces 429 as "Too many attempts — try again in an hour".
const RATE_LIMIT_SCOPE = "career-waitlist";
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/** The five standard UTM keys — anything else in the payload is dropped. */
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
const UTM_VALUE_MAX_LENGTH = 200;
const PH_DISTINCT_ID_MAX_LENGTH = 200;

const REVIEW_TIMING_VALUES: readonly string[] = REVIEW_TIMING_OPTIONS.map(
  (option) => option.value
);

function isReviewTiming(value: unknown): value is ReviewTiming {
  return typeof value === "string" && REVIEW_TIMING_VALUES.includes(value);
}

/** Unknown or missing sources are coerced to a caller-provided default (never a 400 or DB CHECK 500). */
function coerceSource(
  value: unknown,
  fallback: CareerWaitlistSource = "direct"
): CareerWaitlistSource {
  if (
    typeof value === "string" &&
    (CAREER_WAITLIST_SOURCES as readonly string[]).includes(value)
  ) {
    return value as CareerWaitlistSource;
  }
  return fallback;
}

/**
 * Whitelist the payload's utm object to the five standard keys, string
 * values only, each truncated to UTM_VALUE_MAX_LENGTH. Returns null when
 * nothing survives so the column stays NULL instead of `{}`.
 */
function whitelistUtmParams(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.length > 0) {
      utm[key] = raw.slice(0, UTM_VALUE_MAX_LENGTH);
    }
  }

  return Object.keys(utm).length > 0 ? utm : null;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Distinct id precedence: session user id (trusted) → client-forwarded
 * ph_distinct_id → SHA-256 hash of the email. The session id wins so an
 * authenticated join is never mis-attributed by a spoofed ph_distinct_id in
 * the payload; the client value is only used for anonymous joins, where it
 * stitches the event to the same browser session as career_waitlist_viewed.
 * The email is hashed so PostHog never stores it as a raw identifier.
 */
function resolveDistinctId(
  phDistinctId: unknown,
  userId: string | null,
  email: string
): string {
  if (userId) {
    return userId;
  }
  if (
    typeof phDistinctId === "string" &&
    phDistinctId.length > 0 &&
    phDistinctId.length <= PH_DISTINCT_ID_MAX_LENGTH
  ) {
    return phDistinctId;
  }
  return emailDistinctId(email);
}

export async function POST(request: NextRequest) {
  try {
    // Always rate-limit: requests with no forwardable IP fall back to a shared
    // "unknown" bucket (getClientIp) rather than bypassing the only abuse
    // control on this public endpoint. On Vercel real browser traffic always
    // carries x-forwarded-for, so legitimate users don't land in that bucket.
    // checkIpRateLimit fails open internally if the limiter store errors.
    const ip = getClientIp(request);
    const rateLimit = await rateLimitService.checkIpRateLimit(
      ip,
      RATE_LIMIT_SCOPE,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_SECONDS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in an hour." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      // JSON.parse can yield null or a non-object (valid JSON); coerce to {}
      // so field access below returns undefined → clean 400, not a 500.
      body =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // review_timing is optional (the one-click flow drops the question). When
    // present and valid it's recorded; otherwise it's null.
    const reviewTiming: ReviewTiming | null = isReviewTiming(body.review_timing)
      ? body.review_timing
      : null;
    const utm = whitelistUtmParams(body.utm);

    let email: string;
    let userId: string | null;
    let source: CareerWaitlistSource;

    if (body.token !== undefined) {
      // One-click join from a signed email link. The token authenticates the
      // recipient's email, so it's trusted (no disposable-domain check) and the
      // user is resolved by looking the email up in profiles rather than by
      // session (the click is usually logged out).
      const tokenEmail = verifyWaitlistToken(body.token);
      if (!tokenEmail) {
        return NextResponse.json({ error: "Invalid or expired link." }, { status: 400 });
      }
      email = normalizeEmail(tokenEmail);
      source = coerceSource(body.source, "email");
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      userId = profile?.id ?? null;
    } else {
      // Form join (direct/banner): email is required and fully validated.
      const rawEmail = body.email;
      if (typeof rawEmail !== "string" || rawEmail.trim() === "") {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      email = normalizeEmail(rawEmail);
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return NextResponse.json(
          { error: emailValidation.message ?? "Please enter a valid email address" },
          { status: 400 }
        );
      }
      source = coerceSource(body.source);

      // user_id comes ONLY from the server session — never from the payload.
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    }

    const { data: insertedRows, error: insertError } = await serviceClient
      .from("career_waitlist")
      .upsert(
        {
          email,
          user_id: userId,
          review_timing: reviewTiming,
          source,
          utm,
        },
        { onConflict: "email", ignoreDuplicates: true }
      )
      .select("id");

    if (insertError) {
      console.error("[career-waitlist] Insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    // ignoreDuplicates returns zero rows on conflict — only a genuinely new
    // row fires the event, so events ≈ distinct joins.
    const wasInserted = (insertedRows?.length ?? 0) > 0;
    if (wasInserted) {
      const distinctId = resolveDistinctId(body.ph_distinct_id, userId, email);
      after(() =>
        captureServerEvent(distinctId, CAREER_WAITLIST_JOINED_EVENT, {
          review_timing: reviewTiming,
          source,
          ...(utm ?? {}),
        })
      );
    }

    // Re-join (conflict) also lands here: idempotent success, no event.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[career-waitlist] Unhandled error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
