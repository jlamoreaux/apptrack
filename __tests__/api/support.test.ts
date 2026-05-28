/**
 * Tests for POST /api/support
 * Covers auth, body validation, rate limiting, HTML escaping, and send behavior.
 */

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/client";
import { SUPPORT_EMAIL } from "@/lib/constants/site-config";

jest.mock("@/lib/supabase/server");
jest.mock("@/lib/email/client", () => ({
  sendEmail: jest.fn(),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const mockUser = { id: "user123", email: "test@example.com" };

function setAuthedUser(user: { id: string; email?: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  } as any);
}

function createRequest(body: unknown) {
  // A string body is returned verbatim by the mock Request, so passing an
  // invalid-JSON string lets us exercise the malformed-JSON path.
  return new (global as any).NextRequest("http://localhost:3000/api/support", {
    method: "POST",
    body,
  });
}

const validBody = {
  category: "Bug / something broke",
  subject: "Something broke",
  message: "Here is what happened.",
  context: { url: "https://app.example.com/dashboard" },
};

// Import POST fresh so the route's in-module rate-limit map starts empty.
function loadPost() {
  let post!: typeof import("@/app/api/support/route").POST;
  jest.isolateModules(() => {
    post = require("@/app/api/support/route").POST;
  });
  return post;
}

describe("POST /api/support", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true } as any);
    setAuthedUser(mockUser);
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthedUser(null);
    const POST = loadPost();

    const response = await POST(createRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const POST = loadPost();

    const response = await POST(createRequest("{ not valid json"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when subject is missing", async () => {
    const POST = loadPost();

    const response = await POST(
      createRequest({ ...validBody, subject: undefined })
    );

    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when message is empty", async () => {
    const POST = loadPost();

    const response = await POST(
      createRequest({ ...validBody, message: "   " })
    );

    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when subject is over length", async () => {
    const POST = loadPost();

    const response = await POST(
      createRequest({ ...validBody, subject: "a".repeat(201) })
    );

    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when message is over length", async () => {
    const POST = loadPost();

    const response = await POST(
      createRequest({ ...validBody, message: "a".repeat(5001) })
    );

    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for a category not in the allowlist", async () => {
    const POST = loadPost();

    const response = await POST(
      createRequest({ ...validBody, category: "Hacking" })
    );

    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when context URL is too long", async () => {
    const POST = loadPost();

    const response = await POST(
      createRequest({
        ...validBody,
        context: { url: `https://x.com/${"a".repeat(2001)}` },
      })
    );

    expect(response.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user rate limit is exceeded", async () => {
    const POST = loadPost();

    // 5 allowed within the window, the 6th is rejected.
    for (let i = 0; i < 5; i++) {
      const ok = await POST(createRequest(validBody));
      expect(ok.status).toBe(200);
    }

    const limited = await POST(createRequest(validBody));
    const data = await limited.json();

    expect(limited.status).toBe(429);
    expect(data.error).toBeDefined();
    expect(mockSendEmail).toHaveBeenCalledTimes(5);
  });

  it("returns 200 and sends to SUPPORT_EMAIL with reply-to = user email", async () => {
    const POST = loadPost();

    const response = await POST(createRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe(SUPPORT_EMAIL);
    expect(args.replyTo).toBe(mockUser.email);
    expect(args.subject).toBe(
      "[Support] [Bug / something broke] Something broke"
    );
  });

  it("omits reply-to when the user has no email", async () => {
    setAuthedUser({ id: "user-no-email" });
    const POST = loadPost();

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.replyTo).toBeUndefined();
    expect(args.html).toContain("No reply address on file");
  });

  it("escapes user-supplied HTML in the email body", async () => {
    const POST = loadPost();

    await POST(
      createRequest({
        ...validBody,
        subject: "<script>alert(1)</script>",
        message: "<img src=x onerror=alert(1)>",
      })
    );

    const args = mockSendEmail.mock.calls[0][0];
    expect(args.html).not.toContain("<script>alert(1)</script>");
    expect(args.html).toContain("&lt;script&gt;");
    expect(args.html).toContain("&lt;img");
  });

  it("returns success even when the email is mocked (no RESEND_API_KEY)", async () => {
    mockSendEmail.mockResolvedValue({ success: true, mock: true } as any);
    const POST = loadPost();

    const response = await POST(createRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 without leaking provider internals when send fails", async () => {
    mockSendEmail.mockRejectedValue(new Error("Resend internal: API key 12345"));
    const POST = loadPost();

    const response = await POST(createRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to send support request.");
    expect(JSON.stringify(data)).not.toContain("12345");
  });
});
