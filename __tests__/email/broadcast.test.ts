/**
 * Tests for sendBroadcast's recipient reporting: getSubscribedMembers now
 * selects user_id, and the result carries sentRecipients — the recipients of
 * batches Resend accepted (success granularity is per batch of 100).
 */

const mockBatchSend = jest.fn();

jest.mock("@/lib/email/client", () => ({
  resend: { batch: { send: (...args: unknown[]) => mockBatchSend(...args) } },
}));

jest.mock("@/lib/supabase/admin-client", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/email/drip-scheduler", () => ({
  getUnsubscribeUrl: jest.fn((email: string) => `https://unsub.example.com/${email}`),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { sendBroadcast } from "@/lib/email/broadcast";
import { createAdminClient } from "@/lib/supabase/admin-client";

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

type Member = { email: string; first_name: string | null; user_id: string | null };

function mockAudienceMembers(members: Member[]): { select: jest.Mock } {
  const subscribedEq = jest.fn().mockResolvedValue({ data: members, error: null });
  const audienceEq = jest.fn(() => ({ eq: subscribedEq }));
  const select = jest.fn(() => ({ eq: audienceEq }));
  mockCreateAdminClient.mockReturnValue({ from: jest.fn(() => ({ select })) } as never);
  return { select };
}

function member(index: number, withUserId: boolean): Member {
  return {
    email: `user${index}@example.com`,
    first_name: `User${index}`,
    user_id: withUserId ? `user-id-${index}` : null,
  };
}

const baseOptions = {
  audience: "free-users" as const,
  subject: "Test subject",
  getHtml: () => "<p>hi</p>",
};

describe("sendBroadcast sentRecipients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchSend.mockResolvedValue({ data: { data: [] }, error: null });
  });

  it("selects user_id along with email and first_name", async () => {
    const { select } = mockAudienceMembers([member(1, true)]);

    await sendBroadcast(baseOptions);

    expect(select).toHaveBeenCalledWith("email, first_name, user_id");
  });

  it("returns sentRecipients with userId (null preserved) for a successful batch", async () => {
    mockAudienceMembers([member(1, true), member(2, false)]);

    const result = await sendBroadcast(baseOptions);

    expect(result.sentRecipients).toEqual([
      { email: "user1@example.com", userId: "user-id-1" },
      { email: "user2@example.com", userId: null },
    ]);
  });

  it("excludes recipients of a failed batch (per-batch granularity)", async () => {
    // 150 members = 2 batches at the Resend limit of 100
    const members = Array.from({ length: 150 }, (_, i) => member(i, true));
    mockAudienceMembers(members);
    mockBatchSend
      .mockResolvedValueOnce({ data: { data: [] }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });

    const result = await sendBroadcast(baseOptions);

    expect(result.sentRecipients).toHaveLength(100);
    expect(result.sentRecipients[0]).toEqual({
      email: "user0@example.com",
      userId: "user-id-0",
    });
    expect(result.failed).toBe(50);
  });

  it("records only the accepted count when Resend creates fewer messages than the batch", async () => {
    // error null but data.data reports fewer created messages than sent.
    mockAudienceMembers([member(1, true), member(2, true)]);
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: "msg-1" }] },
      error: null,
    });

    const result = await sendBroadcast(baseOptions);

    expect(result.sent).toBe(1);
    expect(result.sentRecipients).toEqual([
      { email: "user1@example.com", userId: "user-id-1" },
    ]);
  });

  it("testEmail path reports the single recipient with null userId and skips the DB", async () => {
    const result = await sendBroadcast({ ...baseOptions, testEmail: "Owner@Example.com " });

    expect(result.sentRecipients).toEqual([{ email: "owner@example.com", userId: null }]);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("passes an explicit from through to the Resend payload", async () => {
    mockAudienceMembers([member(1, true)]);

    await sendBroadcast({ ...baseOptions, from: "Custom <custom@apptrack.ing>" });

    expect(mockBatchSend).toHaveBeenCalledWith([
      expect.objectContaining({ from: "Custom <custom@apptrack.ing>" }),
    ]);
  });
});
