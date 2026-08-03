/**
 * Tests for POST /api/admin/rebrand-email.
 *
 * Covers the send-safety contract: auth rejection, warmed-domain + verified-
 * sender guards, dry-run-by-default (counts only), the CAN-SPAM postal-address
 * requirement, the triple real-send guard (prod + ALLOW_REAL_SEND + confirm),
 * testEmail single-send, and marker-first idempotency.
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

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn(),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/rebrand-email/route";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { sendBroadcast, getAudienceCount } from "@/lib/email/broadcast";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { REBRAND_CAMPAIGN } from "@/lib/constants/rebrand";

const mockVerify = verifyCronAuth as jest.MockedFunction<typeof verifyCronAuth>;
const mockSend = sendBroadcast as jest.MockedFunction<typeof sendBroadcast>;
const mockCount = getAudienceCount as jest.MockedFunction<typeof getAudienceCount>;
const mockAdmin = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

// NODE_ENV is typed readonly; define it so the real-send guard can be exercised.
function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", { value, configurable: true, writable: true });
}

function req(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/rebrand-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function setupSupabase(insertError: { code: string } | null = null) {
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq: updateEq }));
  const client = { from: jest.fn(() => ({ insert, upsert, update })) };
  mockAdmin.mockReturnValue(client as never);
  return { insert, upsert };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue(true);
  process.env.REBRAND_FROM = "Jordan at AppTrack <jordan@apptrack.ing>";
  process.env.REBRAND_REPLY_TO = "jordan@apptrack.ing";
  process.env.COMPANY_POSTAL_ADDRESS = "123 Main St, Springfield, IL 62704";
  delete process.env.ALLOW_REAL_SEND;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/admin/rebrand-email", () => {
  it("401s when auth fails", async () => {
    mockVerify.mockReturnValue(false);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("dry-runs by default: returns audience counts, sends nothing", async () => {
    mockCount.mockResolvedValue(10);
    const res = await POST(req());
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.total).toBe(40); // 4 audiences x 10
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("500s if the sender is not the warmed apptrack.ing domain", async () => {
    process.env.REBRAND_FROM = "CareerOtter <jordan@careerotter.io>";
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/warmed apptrack\.ing/);
  });

  it("500s if the sender is still Resend's test address", async () => {
    process.env.REBRAND_FROM = "AppTrack <onboarding@resend.dev>";
    const res = await POST(req());
    expect(res.status).toBe(500);
  });

  it("refuses a real send outside production even with confirm", async () => {
    process.env.ALLOW_REAL_SEND = "1"; // prod still missing
    const res = await POST(req({ confirm: true }));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses a real send in production without ALLOW_REAL_SEND", async () => {
    const prev = process.env.NODE_ENV;
    setNodeEnv("production");
    const res = await POST(req({ confirm: true }));
    setNodeEnv(prev);
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses a testEmail outside the env guard (no live mail from CI/preview/dev)", async () => {
    const res = await POST(req({ testEmail: "me@example.com" }));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects an ambiguous testEmail + confirm combination", async () => {
    const res = await POST(req({ confirm: true, testEmail: "me@example.com" }));
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("dryRun:true forces the count path even when confirm is also set", async () => {
    const prev = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.ALLOW_REAL_SEND = "1";
    mockCount.mockResolvedValue(3);
    const res = await POST(req({ dryRun: true, confirm: true, audiences: ["leads"] }));
    setNodeEnv(prev);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.total).toBe(3);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it("500s a guarded testEmail when the postal address is missing (CAN-SPAM)", async () => {
    const prev = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.ALLOW_REAL_SEND = "1";
    delete process.env.COMPANY_POSTAL_ADDRESS;
    const res = await POST(req({ testEmail: "me@example.com" }));
    setNodeEnv(prev);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/COMPANY_POSTAL_ADDRESS/);
  });

  it("sends a single guarded testEmail without a marker", async () => {
    const prev = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.ALLOW_REAL_SEND = "1";
    mockSend.mockResolvedValue({ audience: "leads", total: 1, sent: 1, failed: 0, sentRecipients: [] });
    const res = await POST(req({ testEmail: "me@example.com" }));
    setNodeEnv(prev);
    const json = await res.json();
    expect(json.sent).toBe(1);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ testEmail: "me@example.com" }));
    expect(mockAdmin).not.toHaveBeenCalled(); // no campaign marker for a test
  });

  it("real send (prod + ALLOW_REAL_SEND + confirm) claims the marker and broadcasts", async () => {
    const prev = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.ALLOW_REAL_SEND = "1";
    const { insert } = setupSupabase();
    mockSend.mockResolvedValue({ audience: "leads", total: 5, sent: 5, failed: 0, sentRecipients: [] });

    const res = await POST(req({ confirm: true, audiences: ["leads"] }));
    setNodeEnv(prev);

    const json = await res.json();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ campaign: REBRAND_CAMPAIGN }));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(json.sent).toBe(5);
  });

  it("409s when the campaign marker already exists", async () => {
    const prev = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.ALLOW_REAL_SEND = "1";
    setupSupabase({ code: "23505" });

    const res = await POST(req({ confirm: true, audiences: ["leads"] }));
    setNodeEnv(prev);

    expect(res.status).toBe(409);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("400s on an invalid audience", async () => {
    const res = await POST(req({ audiences: ["not-an-audience"] }));
    expect(res.status).toBe(400);
  });
});
