/**
 * Tests for POST /api/career-waitlist
 *
 * Covers: 400s (bad email, bad review_timing), source coercion, email
 * normalization, conflict path (no event, still 2xx), 429, and the
 * career_waitlist_joined event properties + distinct-id precedence.
 * Supabase, the rate limiter, and PostHog are mocked; email validation
 * runs for real (normalization + disposable-domain behavior matter here).
 */

import { POST } from "@/app/api/career-waitlist/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { rateLimitService } from "@/lib/services/rate-limit.service";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREER_EVENTS } from "@/lib/analytics/career-events";
import { emailDistinctId } from "@/lib/analytics/anonymize";
import { REVIEW_TIMING_OPTIONS } from "@/lib/constants/career";
import { generateWaitlistToken } from "@/lib/career/waitlist-token";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service-role-client", () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/rate-limit.service", () => ({
  rateLimitService: {
    checkIpRateLimit: jest.fn(),
  },
}));

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));

const mockCheckIpRateLimit = rateLimitService.checkIpRateLimit as jest.Mock;
const mockCreateClient = createClient as jest.Mock;
const mockCreateServiceRoleClient = createServiceRoleClient as jest.Mock;
const mockCaptureServerEvent = captureServerEvent as jest.Mock;

const VALID_REVIEW_TIMING = REVIEW_TIMING_OPTIONS[0].value; // 'lt_3_months'

let mockUpsert: jest.Mock;
let mockUpsertSelect: jest.Mock;
let mockGetUser: jest.Mock;
let mockProfileMaybeSingle: jest.Mock;

function makeRequest(body: unknown, ip = "203.0.113.10") {
  return new NextRequest("http://localhost:3000/api/career-waitlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    email: "jordan@example.com",
    review_timing: VALID_REVIEW_TIMING,
    ...overrides,
  };
}

/** The row payload passed to upsert in the (single) insert call */
function upsertedRow(): Record<string, unknown> {
  expect(mockUpsert).toHaveBeenCalledTimes(1);
  return mockUpsert.mock.calls[0][0];
}

beforeEach(() => {
  // jest.setup.js clears all mocks before each test; re-arm defaults here.
  mockCheckIpRateLimit.mockResolvedValue({
    allowed: true,
    limit: 5,
    remaining: 4,
    reset: new Date(),
  });

  mockGetUser = jest
    .fn()
    .mockResolvedValue({ data: { user: null }, error: null });
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });

  // Default: a new row is inserted (upsert returns the inserted row).
  mockUpsertSelect = jest
    .fn()
    .mockResolvedValue({ data: [{ id: "new-row-id" }], error: null });
  mockUpsert = jest.fn(() => ({ select: mockUpsertSelect }));
  // Default: token path finds no matching profile (anonymous recipient).
  mockProfileMaybeSingle = jest
    .fn()
    .mockResolvedValue({ data: null, error: null });
  mockCreateServiceRoleClient.mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: mockProfileMaybeSingle }) }),
        };
      }
      return { upsert: mockUpsert };
    }),
  });

  mockCaptureServerEvent.mockResolvedValue(undefined);
});

describe("POST /api/career-waitlist", () => {
  describe("validation failures (400)", () => {
    it("rejects a missing email", async () => {
      const res = await POST(makeRequest({ review_timing: VALID_REVIEW_TIMING }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Email is required");
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns 400 (not 500) for a null JSON body", async () => {
      const res = await POST(makeRequest(null));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Email is required");
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("rejects a malformed email", async () => {
      const res = await POST(makeRequest(validBody({ email: "not-an-email" })));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("valid email");
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });

    it("rejects a disposable-domain email", async () => {
      const res = await POST(
        makeRequest(validBody({ email: "throwaway@mailinator.com" }))
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("permanent email");
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("stores null (not a 400 or DB CHECK 500) for an unknown review_timing", async () => {
      const res = await POST(
        makeRequest(validBody({ review_timing: "next_century" }))
      );

      expect(res.status).toBe(200);
      expect(upsertedRow().review_timing).toBeNull();
    });

    it("accepts a missing review_timing (the question is optional now)", async () => {
      const res = await POST(makeRequest({ email: "jordan@example.com" }));

      expect(res.status).toBe(200);
      expect(upsertedRow().review_timing).toBeNull();
    });
  });

  describe("rate limiting (429)", () => {
    it("returns 429 with a friendly message and never touches the DB", async () => {
      mockCheckIpRateLimit.mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
        reset: new Date(),
        retryAfter: 3600,
      });

      const res = await POST(makeRequest(validBody(), "198.51.100.7"));
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("Too many attempts");
      expect(mockCheckIpRateLimit).toHaveBeenCalledWith(
        "198.51.100.7",
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });
  });

  describe("one-click token join", () => {
    it("joins the token's email with null review_timing and source 'email'", async () => {
      const token = generateWaitlistToken("Recipient@Example.com");
      const res = await POST(makeRequest({ token }));

      expect(res.status).toBe(200);
      const row = upsertedRow();
      expect(row.email).toBe("recipient@example.com");
      expect(row.review_timing).toBeNull();
      expect(row.source).toBe("email");
    });

    it("resolves user_id by looking the token email up in profiles", async () => {
      mockProfileMaybeSingle.mockResolvedValue({
        data: { id: "profile-user-9" },
        error: null,
      });
      const token = generateWaitlistToken("member@example.com");

      await POST(makeRequest({ token }));

      expect(upsertedRow().user_id).toBe("profile-user-9");
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "profile-user-9",
        CAREER_EVENTS.WAITLIST_JOINED,
        expect.any(Object)
      );
    });

    it("falls back to a hashed-email distinct id when the recipient isn't a user", async () => {
      const token = generateWaitlistToken("stranger@example.com");

      await POST(makeRequest({ token }));

      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        emailDistinctId("stranger@example.com"),
        CAREER_EVENTS.WAITLIST_JOINED,
        expect.any(Object)
      );
    });

    it("rejects a forged/invalid token with 400 and never inserts", async () => {
      const res = await POST(makeRequest({ token: "not-a-real-token.deadbeef" }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid");
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });

    it("is idempotent: a re-click (conflict) succeeds with no event", async () => {
      mockUpsertSelect.mockResolvedValue({ data: [], error: null });
      const token = generateWaitlistToken("repeat@example.com");

      const res = await POST(makeRequest({ token }));

      expect(res.status).toBe(200);
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });
  });

  describe("insert semantics", () => {
    it("normalizes mixed-case/whitespace email before validation and insert", async () => {
      const res = await POST(
        makeRequest(validBody({ email: "  Jordan@EXAMPLE.com  " }))
      );

      expect(res.status).toBe(200);
      expect(upsertedRow().email).toBe("jordan@example.com");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.any(Object),
        { onConflict: "email", ignoreDuplicates: true }
      );
    });

    it("coerces an unknown source to 'direct'", async () => {
      await POST(makeRequest(validBody({ source: "twitter" })));

      expect(upsertedRow().source).toBe("direct");
    });

    it("defaults a missing source to 'direct'", async () => {
      await POST(makeRequest(validBody()));

      expect(upsertedRow().source).toBe("direct");
    });

    it("keeps a recognized source", async () => {
      await POST(makeRequest(validBody({ source: "banner" })));

      expect(upsertedRow().source).toBe("banner");
    });

    it("whitelists utm to the five standard keys and truncates long values", async () => {
      const oversized = "x".repeat(250);
      await POST(
        makeRequest(
          validBody({
            utm: {
              utm_source: oversized,
              utm_campaign: "career_companion_validation",
              utm_nonsense: "dropped",
              utm_medium: 42, // non-string: dropped
            },
          })
        )
      );

      expect(upsertedRow().utm).toEqual({
        utm_source: "x".repeat(200),
        utm_campaign: "career_companion_validation",
      });
    });

    it("stores utm as null when the payload utm is not an object", async () => {
      await POST(makeRequest(validBody({ utm: "utm_source=email" })));

      expect(upsertedRow().utm).toBeNull();
    });

    it("resolves user_id from the session, never from the payload", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "session-user-1" } },
        error: null,
      });

      await POST(makeRequest(validBody({ user_id: "attacker-controlled" })));

      expect(upsertedRow().user_id).toBe("session-user-1");
    });

    it("stores a null user_id for anonymous visitors", async () => {
      await POST(makeRequest(validBody({ user_id: "attacker-controlled" })));

      expect(upsertedRow().user_id).toBeNull();
    });

    it("returns 500 with a clear error when the insert fails", async () => {
      mockUpsertSelect.mockResolvedValue({
        data: null,
        error: { message: "connection refused" },
      });

      const res = await POST(makeRequest(validBody()));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Something went wrong");
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });
  });

  describe("career_waitlist_joined event", () => {
    it("fires on a fresh insert with review_timing, source, and whitelisted UTMs", async () => {
      const res = await POST(
        makeRequest(
          validBody({
            source: "email",
            ph_distinct_id: "ph-browser-123",
            utm: {
              utm_source: "email",
              utm_campaign: "career_companion_validation",
              utm_junk: "dropped",
            },
          })
        )
      );

      expect(res.status).toBe(200);
      expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "ph-browser-123",
        CAREER_EVENTS.WAITLIST_JOINED,
        {
          review_timing: VALID_REVIEW_TIMING,
          source: "email",
          utm_source: "email",
          utm_campaign: "career_companion_validation",
        }
      );
    });

    it("re-join (conflict) returns 200 success without firing the event", async () => {
      // ignoreDuplicates: true yields zero returned rows on conflict
      mockUpsertSelect.mockResolvedValue({ data: [], error: null });

      const res = await POST(makeRequest(validBody()));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });

    describe("distinct id precedence", () => {
      it("prefers the session user id over a client-supplied ph_distinct_id", async () => {
        mockGetUser.mockResolvedValue({
          data: { user: { id: "session-user-1" } },
          error: null,
        });

        // A spoofed ph_distinct_id must not override the trusted session id.
        await POST(makeRequest(validBody({ ph_distinct_id: "spoofed" })));

        expect(mockCaptureServerEvent).toHaveBeenCalledWith(
          "session-user-1",
          CAREER_EVENTS.WAITLIST_JOINED,
          expect.any(Object)
        );
      });

      it("uses ph_distinct_id for anonymous joins (browser-session stitching)", async () => {
        await POST(makeRequest(validBody({ ph_distinct_id: "ph-anon" })));

        expect(mockCaptureServerEvent).toHaveBeenCalledWith(
          "ph-anon",
          CAREER_EVENTS.WAITLIST_JOINED,
          expect.any(Object)
        );
      });

      it("falls back to a hashed email when anonymous with no ph_distinct_id", async () => {
        await POST(makeRequest(validBody({ email: "  Anon@Example.COM " })));

        // Hashed, not raw email — PostHog never stores the address as an id.
        expect(mockCaptureServerEvent).toHaveBeenCalledWith(
          emailDistinctId("anon@example.com"),
          CAREER_EVENTS.WAITLIST_JOINED,
          expect.any(Object)
        );
      });

      it("ignores an oversized ph_distinct_id (>200 chars)", async () => {
        await POST(
          makeRequest(validBody({ ph_distinct_id: "p".repeat(201) }))
        );

        expect(mockCaptureServerEvent).toHaveBeenCalledWith(
          emailDistinctId("jordan@example.com"),
          CAREER_EVENTS.WAITLIST_JOINED,
          expect.any(Object)
        );
      });

      it("ignores a non-string ph_distinct_id", async () => {
        await POST(makeRequest(validBody({ ph_distinct_id: 12345 })));

        expect(mockCaptureServerEvent).toHaveBeenCalledWith(
          emailDistinctId("jordan@example.com"),
          CAREER_EVENTS.WAITLIST_JOINED,
          expect.any(Object)
        );
      });
    });
  });
});
