/**
 * Year in review email: who gets which version, what the copy withholds, and
 * how a wave resumes from its saved cursor.
 */

const mockBatchSend = jest.fn();
jest.mock("@/lib/email/client", () => ({
  resend: { batch: { send: (...args: unknown[]) => mockBatchSend(...args) } },
}));

jest.mock("@/lib/email/preferences", () => ({
  filterSendableRecipients: jest.fn(),
}));

jest.mock("@/lib/supabase/admin-client", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { buildRecapRecipients, type RecapRecipient } from "@/lib/year-in-review/email-recipients";
import { getYearInReviewEmail, yearInReviewCampaignId } from "@/lib/email/templates/year-in-review";
import { CAMPAIGN_BATCH_SIZE, runYearInReviewCampaign } from "@/lib/email/year-in-review-campaign";
import { filterSendableRecipients } from "@/lib/email/preferences";
import { createAdminClient } from "@/lib/supabase/admin-client";

const mockSendable = filterSendableRecipients as jest.MockedFunction<typeof filterSendableRecipients>;
const mockAdmin = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

function row(user_id: string, status = "Applied", full_name: string | null = "Sam Rivera") {
  return { user_id, email: `${user_id}@example.com`, full_name, status };
}

describe("buildRecapRecipients", () => {
  it("groups by user, counts applications and flags a hire", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row("b")),
      row("a", "Hired", null),
      row("a"),
    ];
    const [a, b] = buildRecapRecipients(rows);
    expect(a).toMatchObject({ userId: "a", applications: 2, hired: true, audience: "light", firstName: undefined });
    expect(b).toMatchObject({ userId: "b", applications: 5, hired: false, audience: "labeled", firstName: "Sam" });
  });

  it("orders by userId so a cursor can resume", () => {
    const ids = buildRecapRecipients([row("c"), row("a"), row("b")]).map((r) => r.userId);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("getYearInReviewEmail", () => {
  const base = {
    year: 2026,
    wave: "launch" as const,
    applications: 39,
    hired: false,
    firstName: "Sam",
    unsubscribeUrl: "https://careerotter.io/api/email/unsubscribe?x=1",
    postalAddress: "123 Main St",
  };

  it("teases the label without naming one", () => {
    const { subject, html } = getYearInReviewEmail({ ...base, audience: "labeled" });
    expect(subject).toBe("Which otter were you in 2026?");
    expect(html).toContain("You logged 39 applications in 2026.");
    expect(html).toContain("lineup.jpg");
    expect(html).not.toMatch(/The (Connector|Craftsperson|Curator|Researcher|Explorer|Sprint|Long Game)/);
  });

  it("gives light users the plain version with the walking otter", () => {
    const { subject, html } = getYearInReviewEmail({ ...base, audience: "light", applications: 1 });
    expect(subject).toBe("Your 2026 job search, in review");
    expect(html).toContain("You logged 1 application in 2026.");
    expect(html).toContain("still-in-it.jpg");
    expect(html).not.toContain("lineup.jpg");
  });

  it("links to the recap with campaign tracking and carries the footer essentials", () => {
    const { html } = getYearInReviewEmail({ ...base, audience: "labeled", wave: "last-call", hired: true });
    expect(html).toContain("utm_campaign=year_in_review_2026_last_call");
    expect(html).toContain("/dashboard/year-in-review?year=2026");
    expect(html).toContain("And it ends with the job you landed.");
    expect(html).toContain("123 Main St");
    expect(html).toContain("unsubscribe?x=1");
  });

  it("escapes the first name", () => {
    const { html } = getYearInReviewEmail({ ...base, audience: "light", firstName: "<b>Sam</b>" });
    expect(html).toContain("Hi &lt;b&gt;Sam&lt;/b&gt;,");
  });
});

describe("runYearInReviewCampaign", () => {
  const campaign = yearInReviewCampaignId(2026, "launch");

  function recipients(count: number): RecapRecipient[] {
    return Array.from({ length: count }, (_, i) => ({
      userId: `u${String(i).padStart(4, "0")}`,
      email: `u${i}@example.com`,
      applications: 6,
      hired: false,
      audience: "labeled" as const,
    }));
  }

  function setupSupabase(existing: Record<string, unknown> | null) {
    const saved: Array<Record<string, unknown>> = [];
    const client = {
      from: jest.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing ? { metadata: existing } : null, error: null }) }) }),
        insert: jest.fn(async () => ({ error: null })),
        update: jest.fn((values: Record<string, unknown>) => ({
          eq: async () => {
            saved.push(JSON.parse(JSON.stringify(values.metadata)));
            return { error: null };
          },
        })),
      })),
    };
    mockAdmin.mockReturnValue(client as never);
    return saved;
  }

  const options = {
    year: 2026,
    wave: "launch" as const,
    from: "CareerOtter <hello@careerotter.io>",
    postalAddress: "123 Main St",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendable.mockImplementation(async (list) => new Set(list.map((r) => r.userId)));
    mockBatchSend.mockImplementation(async (emails: unknown[]) => ({
      data: { data: emails.map((_, i) => ({ id: String(i) })) },
      error: null,
    }));
  });

  it("sends in batches, saves the cursor after each, and finishes", async () => {
    const saved = setupSupabase(null);
    const list = recipients(CAMPAIGN_BATCH_SIZE + 5);
    const result = await runYearInReviewCampaign({ ...options, recipients: list, deadline: Date.now() + 60_000 });

    expect(mockBatchSend).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "sent", remaining: 0, progress: { sent: 105, done: true } });
    expect(saved.map((p) => p.cursor)).toEqual([list[99].userId, list[104].userId]);

    const [emails, requestOptions] = mockBatchSend.mock.calls[0];
    expect(requestOptions).toMatchObject({ batchValidation: "permissive" });
    expect(requestOptions.idempotencyKey).toContain(campaign);
    expect(emails[0].tags).toContainEqual({ name: "campaign", value: campaign });
    expect(emails[0].headers["List-Unsubscribe"]).toMatch(/category=digest/);
  });

  it("resumes after the saved cursor", async () => {
    const list = recipients(10);
    setupSupabase({ cursor: list[6].userId, sent: 7, skipped: 0, failed: 0, done: false });
    const result = await runYearInReviewCampaign({ ...options, recipients: list, deadline: Date.now() + 60_000 });

    const sentTo = mockBatchSend.mock.calls[0][0].map((e: { to: string }) => e.to);
    expect(sentTo).toEqual(["u7@example.com", "u8@example.com", "u9@example.com"]);
    expect(result).toMatchObject({ progress: { sent: 10, done: true } });
  });

  it("stops at the deadline and reports what is left", async () => {
    setupSupabase(null);
    const result = await runYearInReviewCampaign({ ...options, recipients: recipients(10), deadline: Date.now() - 1 });
    expect(mockBatchSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "sent", remaining: 10, progress: { done: false } });
  });

  it("refuses a finished wave unless forced", async () => {
    setupSupabase({ cursor: "u9", sent: 10, skipped: 0, failed: 0, done: true });
    const result = await runYearInReviewCampaign({ ...options, recipients: recipients(3), deadline: Date.now() + 60_000 });
    expect(result.status).toBe("already-sent");
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("skips opted-out users and counts per-email rejections", async () => {
    setupSupabase(null);
    const list = recipients(4);
    mockSendable.mockResolvedValue(new Set([list[0].userId, list[1].userId, list[2].userId]));
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: "1" }, { id: "2" }], errors: [{ index: 2, message: "invalid address" }] },
      error: null,
    });
    const result = await runYearInReviewCampaign({ ...options, recipients: list, deadline: Date.now() + 60_000 });
    expect(result).toMatchObject({ progress: { sent: 2, failed: 1, skipped: 1, done: true } });
  });
});
