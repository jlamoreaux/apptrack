/**
 * Tests for /api/try/capture-email
 *
 * Tests the email validation, rate limiting, and audience scheduling
 * without hitting real Supabase/Resend (mocked).
 */

import { POST } from "@/app/api/try/capture-email/route";
import { NextRequest } from "next/server";

// Mock the email validation
jest.mock("@/lib/email/validate", () => ({
  validateEmail: jest.fn((email: string) => {
    if (!email || !email.includes("@")) {
      return { valid: false, message: "Invalid email address" };
    }
    if (email.endsWith("@mailinator.com")) {
      return { valid: false, message: "Disposable email addresses are not allowed" };
    }
    return { valid: true };
  }),
}));

// Mock the drip scheduler
jest.mock("@/lib/email/drip-scheduler", () => ({
  scheduleDripSequence: jest.fn().mockResolvedValue({ immediateEmailsSent: 1 }),
}));

function makeRequest(body: Record<string, unknown>, ip = "127.0.0.1") {
  const req = new NextRequest("http://localhost:3000/api/try/capture-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
  return req;
}

describe("/api/try/capture-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when email is missing", async () => {
    const req = makeRequest({ source: "cover-letter" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Email is required");
  });

  it("returns 400 when source is missing", async () => {
    const req = makeRequest({ email: "test@example.com" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Source is required");
  });

  it("returns 400 for invalid email format", async () => {
    const req = makeRequest({ email: "notanemail", source: "job-fit" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid");
  });

  it("returns 400 for disposable email", async () => {
    const req = makeRequest({
      email: "test@mailinator.com",
      source: "job-fit",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Disposable");
  });

  it("returns 200 and calls scheduleDripSequence for valid email", async () => {
    const { scheduleDripSequence } = require("@/lib/email/drip-scheduler");

    const req = makeRequest({
      email: "Valid@Example.COM",
      source: "cover-letter",
    }, "10.0.3.3");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(scheduleDripSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "valid@example.com", // normalized
        audience: "leads",
        metadata: expect.objectContaining({
          source: "try-cover-letter",
        }),
      })
    );
  });

  it("normalizes email to lowercase and trimmed", async () => {
    const { scheduleDripSequence } = require("@/lib/email/drip-scheduler");

    const req = makeRequest({
      email: "  User@EXAMPLE.com  ",
      source: "interview-prep",
    }, "10.0.1.1");
    await POST(req);

    expect(scheduleDripSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
      })
    );
  });

  it("passes firstName and sessionId in metadata when provided", async () => {
    const { scheduleDripSequence } = require("@/lib/email/drip-scheduler");

    const req = makeRequest({
      email: "test@example.com",
      source: "job-fit",
      firstName: "Jordan",
      sessionId: "sess_123",
    }, "10.0.2.2");
    await POST(req);

    expect(scheduleDripSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Jordan",
        metadata: expect.objectContaining({
          sessionId: "sess_123",
        }),
      })
    );
  });

  it("returns 429 after exceeding rate limit", async () => {
    const testIp = "192.168.99.99";

    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      const req = makeRequest(
        { email: `test${i}@example.com`, source: "job-fit" },
        testIp
      );
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // 6th should be rate limited
    const req = makeRequest(
      { email: "test6@example.com", source: "job-fit" },
      testIp
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });
});
