/**
 * POST /api/admin/year-in-review-email: dry run by default, and every live
 * send behind the environment guard and the recap's own launch gate.
 */

jest.mock("@/lib/email/lifecycle-cron", () => ({
  verifyCronAuth: jest.fn(() => true),
}));

jest.mock("@/lib/email/client", () => ({
  sendEmail: jest.fn(async () => ({ success: true })),
  resend: null,
}));

jest.mock("@/lib/email/year-in-review-campaign", () => ({
  ...jest.requireActual("@/lib/email/year-in-review-campaign"),
  runYearInReviewCampaign: jest.fn(),
}));

jest.mock("@/lib/year-in-review/email-recipients", () => ({
  findRecapRecipients: jest.fn(),
}));

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn(),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/year-in-review-email/route";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { sendEmail } from "@/lib/email/client";
import { runYearInReviewCampaign } from "@/lib/email/year-in-review-campaign";
import { findRecapRecipients } from "@/lib/year-in-review/email-recipients";

const mockVerify = verifyCronAuth as jest.MockedFunction<typeof verifyCronAuth>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockRun = runYearInReviewCampaign as jest.MockedFunction<typeof runYearInReviewCampaign>;
const mockFind = findRecapRecipients as jest.MockedFunction<typeof findRecapRecipients>;

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", { value, configurable: true, writable: true });
}

function req(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/year-in-review-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function live() {
  setNodeEnv("production");
  process.env.ALLOW_REAL_SEND = "1";
  process.env.YEAR_IN_REVIEW_ENABLED = "1";
}

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue(true);
  process.env.YEAR_IN_REVIEW_FROM = "CareerOtter <hello@careerotter.io>";
  process.env.COMPANY_POSTAL_ADDRESS = "123 Main St, Springfield, IL 62704";
  delete process.env.ALLOW_REAL_SEND;
  delete process.env.YEAR_IN_REVIEW_ENABLED;
  delete process.env.CI;
  mockFind.mockResolvedValue([
    { userId: "a", email: "a@example.com", applications: 8, hired: true, audience: "labeled" },
    { userId: "b", email: "b@example.com", applications: 2, hired: false, audience: "light" },
  ]);
});

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/admin/year-in-review-email", () => {
  it("401s when auth fails", async () => {
    mockVerify.mockReturnValue(false);
    expect((await POST(req({ wave: "launch" }))).status).toBe(401);
  });

  it("400s without a valid wave", async () => {
    expect((await POST(req())).status).toBe(400);
    expect((await POST(req({ wave: "nudge" }))).status).toBe(400);
  });

  it("400s for a year before the product existed", async () => {
    expect((await POST(req({ wave: "launch", year: 2019 }))).status).toBe(400);
  });

  it("dry-runs by default with counts per version", async () => {
    const res = await POST(req({ wave: "launch", year: 2025 }));
    const json = await res.json();
    expect(json).toMatchObject({ dryRun: true, year: 2025, recipients: { total: 2, labeled: 1, light: 1, hired: 1 } });
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("refuses Resend's test sender", async () => {
    process.env.YEAR_IN_REVIEW_FROM = "CareerOtter <onboarding@resend.dev>";
    expect((await POST(req({ wave: "launch" }))).status).toBe(500);
  });

  it("refuses a live send outside production", async () => {
    process.env.ALLOW_REAL_SEND = "1";
    process.env.YEAR_IN_REVIEW_ENABLED = "1";
    expect((await POST(req({ wave: "launch", confirm: true }))).status).toBe(403);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("refuses a live send while the recap itself is off", async () => {
    live();
    delete process.env.YEAR_IN_REVIEW_ENABLED;
    const res = await POST(req({ wave: "launch", confirm: true }));
    expect(res.status).toBe(409);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("rejects testEmail together with confirm", async () => {
    live();
    expect((await POST(req({ wave: "launch", confirm: true, testEmail: "me@example.com" }))).status).toBe(400);
  });

  it("sends both versions to a test address and nothing else", async () => {
    live();
    const res = await POST(req({ wave: "launch", testEmail: "Me@Example.com" }));
    const json = await res.json();
    expect(json.sent).toEqual(["labeled", "light"]);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail.mock.calls.every(([args]) => args.to === "me@example.com")).toBe(true);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("runs the wave and reports progress", async () => {
    live();
    mockRun.mockResolvedValue({
      status: "sent",
      campaign: "year_in_review_2025_launch",
      progress: { cursor: "b", sent: 2, skipped: 0, failed: 0, done: true },
      remaining: 0,
    });
    const res = await POST(req({ wave: "launch", year: 2025, confirm: true }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ campaign: "year_in_review_2025_launch", sent: 2, done: true, remaining: 0 });
    expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ wave: "launch", year: 2025, force: false }));
  });

  it("409s a wave that already finished", async () => {
    live();
    mockRun.mockResolvedValue({
      status: "already-sent",
      campaign: "year_in_review_2025_launch",
      progress: { cursor: "b", sent: 2, skipped: 0, failed: 0, done: true },
    });
    expect((await POST(req({ wave: "launch", year: 2025, confirm: true }))).status).toBe(409);
  });
});
