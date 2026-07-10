/**
 * Tests for POST /api/admin/career-validation-email.
 *
 * Covers the send-safety contract: auth rejection, the FROM_EMAIL guard,
 * dry-run (counts only, no marker), testEmail (one email, no marker, no
 * events), marker-first idempotency (409 without force, upsert with force),
 * and per-recipient career_email_sent capture through a local batched
 * PostHog client.
 */

jest.mock("@/lib/email/lifecycle-cron", () => ({
  verifyCronAuth: jest.fn(() => true),
}));

jest.mock("@/lib/email/broadcast", () => ({
  sendBroadcast: jest.fn(),
  getAudienceCount: jest.fn(),
}));

jest.mock("@/lib/supabase/admin-client", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("posthog-node", () => ({
  PostHog: jest.fn(),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logSecurityEvent: jest.fn(),
  },
}));

import { NextRequest } from "next/server";
import { PostHog } from "posthog-node";
import { POST } from "@/app/api/admin/career-validation-email/route";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { sendBroadcast, getAudienceCount } from "@/lib/email/broadcast";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { CAREER_CAMPAIGN } from "@/lib/constants/career";
import { emailDistinctId } from "@/lib/analytics/anonymize";

const mockVerifyCronAuth = verifyCronAuth as jest.MockedFunction<typeof verifyCronAuth>;
const mockSendBroadcast = sendBroadcast as jest.MockedFunction<typeof sendBroadcast>;
const mockGetAudienceCount = getAudienceCount as jest.MockedFunction<typeof getAudienceCount>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const MockPostHog = PostHog as jest.MockedClass<typeof PostHog>;

const FROM_EMAIL = "AppTrack <hello@apptrack.ing>";
const EXPECTED_FROM = "Jordan at AppTrack <jordan@apptrack.ing>";
const EXPECTED_REPLY_TO = "jordan@apptrack.ing";
const DEFAULT_AUDIENCES = ["leads", "free-users", "trial-users", "paid-users"] as const;

type SupabaseMock = {
  client: { from: jest.Mock };
  insert: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  updateEq: jest.Mock;
};

function setupSupabaseMock(overrides: { insertError?: { code: string } } = {}): SupabaseMock {
  const insert = jest.fn().mockResolvedValue({ error: overrides.insertError ?? null });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq: updateEq }));
  const client = { from: jest.fn(() => ({ insert, upsert, update })) };
  mockCreateAdminClient.mockReturnValue(client as never);
  return { client, insert, upsert, update, updateEq };
}

const posthogCapture = jest.fn();
const posthogShutdown = jest.fn().mockResolvedValue(undefined);

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/career-validation-email", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
    body: JSON.stringify(body ?? {}),
  });
}

/** Two recipients per audience: one with a user_id, one anonymous. */
function mockSuccessfulBroadcasts() {
  mockSendBroadcast.mockImplementation(async ({ audience }) => ({
    audience,
    total: 2,
    sent: 2,
    failed: 0,
    sentRecipients: [
      { email: `${audience}-a@example.com`, userId: `${audience}-user-a` },
      { email: `${audience}-b@example.com`, userId: null },
    ],
  }));
}

const ORIGINAL_ENV = process.env;

describe("POST /api/admin/career-validation-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      FROM_EMAIL,
      CAREER_VALIDATION_FROM: EXPECTED_FROM,
      CAREER_VALIDATION_REPLY_TO: EXPECTED_REPLY_TO,
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    };
    mockVerifyCronAuth.mockReturnValue(true);
    MockPostHog.mockImplementation(
      () => ({ capture: posthogCapture, shutdown: posthogShutdown }) as never
    );
    setupSupabaseMock();
    mockSuccessfulBroadcasts();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 401 when cron auth fails, without touching send or marker paths", async () => {
    mockVerifyCronAuth.mockReturnValue(false);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(mockSendBroadcast).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for audiences outside the AudienceId set", async () => {
    const res = await POST(makeRequest({ audiences: ["free-users", "everyone"] }));

    expect(res.status).toBe(400);
    expect(mockSendBroadcast).not.toHaveBeenCalled();
  });

  it("returns 400 (not 500) when audiences is not an array", async () => {
    const res = await POST(makeRequest({ audiences: "free-users" }));

    expect(res.status).toBe(400);
    expect(mockSendBroadcast).not.toHaveBeenCalled();
  });

  it("returns 400 (not 500) when testEmail is a non-string", async () => {
    const res = await POST(makeRequest({ testEmail: 123 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("testEmail");
    expect(mockSendBroadcast).not.toHaveBeenCalled();
  });

  it("de-duplicates repeated audiences so a segment is not sent twice", async () => {
    setupSupabaseMock();

    await POST(makeRequest({ audiences: ["leads", "leads"] }));

    expect(mockSendBroadcast).toHaveBeenCalledTimes(1);
    expect(mockSendBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ audience: "leads" })
    );
  });

  it("returns 500 before any send path when the from address is the Resend test address", async () => {
    process.env.CAREER_VALIDATION_FROM = "AppTrack <onboarding@resend.dev>";

    const res = await POST(makeRequest({ testEmail: "owner@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("CAREER_VALIDATION_FROM");
    expect(mockSendBroadcast).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("dry run returns per-audience counts and sends nothing, writes no marker", async () => {
    mockGetAudienceCount.mockImplementation(async (audience) =>
      audience === "paid-users" ? 5 : 10
    );

    const res = await POST(makeRequest({ dryRun: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      dryRun: true,
      audiences: { leads: 10, "free-users": 10, "trial-users": 10, "paid-users": 5 },
      total: 35,
    });
    expect(mockGetAudienceCount).toHaveBeenCalledTimes(4);
    expect(mockSendBroadcast).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(MockPostHog).not.toHaveBeenCalled();
  });

  it("testEmail sends exactly one broadcast with explicit from, no marker, no events", async () => {
    const res = await POST(makeRequest({ testEmail: "owner@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.testEmail).toBe("owner@example.com");
    expect(mockSendBroadcast).toHaveBeenCalledTimes(1);
    expect(mockSendBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        testEmail: "owner@example.com",
        from: EXPECTED_FROM,
        replyTo: EXPECTED_REPLY_TO,
      })
    );
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(MockPostHog).not.toHaveBeenCalled();
  });

  it("real send inserts the marker before sending and broadcasts each default audience", async () => {
    const supabase = setupSupabaseMock();
    const callOrder: string[] = [];
    supabase.insert.mockImplementation(async () => {
      callOrder.push("marker");
      return { error: null };
    });
    mockSendBroadcast.mockImplementation(async ({ audience }) => {
      callOrder.push(`send:${audience}`);
      return { audience, total: 1, sent: 1, failed: 0, sentRecipients: [] };
    });

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(callOrder[0]).toBe("marker");
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ campaign: CAREER_CAMPAIGN, recipient_count: 0 })
    );
    expect(mockSendBroadcast).toHaveBeenCalledTimes(4);
    for (const audience of DEFAULT_AUDIENCES) {
      expect(mockSendBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({ audience, from: EXPECTED_FROM, replyTo: EXPECTED_REPLY_TO })
      );
    }
    expect(data).toMatchObject({ total: 4, sent: 4, failed: 0 });
  });

  it("captures career_email_sent per recipient using userId, else the hashed email", async () => {
    const supabase = setupSupabaseMock();

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    // 4 audiences x 2 recipients
    expect(posthogCapture).toHaveBeenCalledTimes(8);
    expect(posthogCapture).toHaveBeenCalledWith({
      distinctId: "free-users-user-a",
      event: "career_email_sent",
      properties: { campaign: CAREER_CAMPAIGN },
    });
    // Anonymous recipient (no userId): distinct id is the hashed email, never
    // the raw address.
    expect(posthogCapture).toHaveBeenCalledWith({
      distinctId: emailDistinctId("free-users-b@example.com"),
      event: "career_email_sent",
      properties: { campaign: CAREER_CAMPAIGN },
    });
    expect(posthogShutdown).toHaveBeenCalledTimes(1);
    // Durable gate denominator persisted on the marker row
    expect(supabase.update).toHaveBeenCalledWith({ recipient_count: 8 });
    expect(supabase.updateEq).toHaveBeenCalledWith("campaign", CAREER_CAMPAIGN);
  });

  it("second real trigger returns 409 without force and sends nothing", async () => {
    setupSupabaseMock({ insertError: { code: "23505" } });

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("force");
    expect(mockSendBroadcast).not.toHaveBeenCalled();
    expect(posthogCapture).not.toHaveBeenCalled();
  });

  it("force upserts the marker and proceeds with the send", async () => {
    const supabase = setupSupabaseMock();

    const res = await POST(makeRequest({ force: true }));

    expect(res.status).toBe(200);
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ campaign: CAREER_CAMPAIGN }),
      { onConflict: "campaign" }
    );
    expect(supabase.insert).not.toHaveBeenCalled();
    expect(mockSendBroadcast).toHaveBeenCalledTimes(4);
  });

  it("isolates a failing audience: reports it in failedAudiences without aborting the others", async () => {
    const supabase = setupSupabaseMock();
    // 'leads' (first default audience) fails; the rest succeed.
    mockSendBroadcast.mockImplementation(async ({ audience }) => {
      if (audience === "leads") {
        throw new Error("resend down");
      }
      return {
        audience,
        total: 1,
        sent: 1,
        failed: 0,
        sentRecipients: [{ email: `${audience}@example.com`, userId: null }],
      };
    });

    const res = await POST(makeRequest());
    const data = await res.json();

    // The loop completes rather than returning 500 mid-way (which would force a
    // full-campaign force retry that re-emails the audiences that succeeded).
    expect(res.status).toBe(200);
    expect(data.failedAudiences).toEqual(["leads"]);
    expect(data.sent).toBe(3);
    // Marker stays (fail-closed); recipient_count reflects what actually sent.
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(supabase.update).toHaveBeenCalledWith({ recipient_count: 3 });
  });

  it("passes a getHtml that renders the career validation template", async () => {
    await POST(makeRequest({ testEmail: "owner@example.com" }));

    const options = mockSendBroadcast.mock.calls[0][0];
    const html = options.getHtml({
      email: "owner@example.com",
      firstName: "Jordan",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(html).toContain("Hi Jordan,");
    expect(html).toContain("Join the waitlist");
    expect(html).toContain(`utm_campaign=${CAREER_CAMPAIGN}`);
    expect(html).toContain("https://example.com/unsub");
  });
});
