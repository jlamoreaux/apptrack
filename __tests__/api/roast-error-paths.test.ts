/**
 * Tests for the roast API error paths.
 *
 * When a roast request fails, POST /api/roast and GET /api/roast/[id] must
 * return their designed JSON error responses and POST must still fire the
 * `api_error` analytics capture with a defined distinct id.
 */

// next/server is mocked globally in jest.setup.js; its `after` mock runs
// callbacks synchronously, so analytics assertions see the capture immediately.

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ "user-agent": "jest", "x-forwarded-for": "127.0.0.1" })),
  cookies: jest.fn(async () => ({ set: jest.fn(), get: jest.fn() })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/roast/resume-parser", () => ({
  extractTextFromResume: jest.fn(),
  filterPII: jest.fn((text: string) => text),
}));

jest.mock("@/lib/roast/roast-generator-v2", () => ({
  generateRoast: jest.fn(),
}));

jest.mock("@/lib/roast/rate-limiter", () => ({
  checkRoastRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  checkGuestRoastRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/lib/services/analytics-server.service", () => ({
  serverAnalyticsService: { trackEvent: jest.fn() },
}));

jest.mock("@/lib/email/validate", () => ({
  validateEmail: jest.fn(() => ({ valid: true })),
}));

jest.mock("@/lib/email/drip-scheduler", () => ({
  scheduleDripSequence: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/email/transactional", () => ({
  sendRoastReadyEmail: jest.fn().mockResolvedValue({ success: true }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/roast/route";
import { GET } from "@/app/api/roast/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromResume } from "@/lib/roast/resume-parser";
import { generateRoast } from "@/lib/roast/roast-generator-v2";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockExtractText = extractTextFromResume as jest.MockedFunction<typeof extractTextFromResume>;
const mockGenerateRoast = generateRoast as jest.MockedFunction<typeof generateRoast>;
const mockCaptureServerEvent = captureServerEvent as jest.MockedFunction<typeof captureServerEvent>;

/** Minimal File stand-in — the route only reads type, name, and size. */
const validFileStub = {
  type: "application/pdf",
  name: "resume.pdf",
  size: 1024,
};

/**
 * NextRequest whose formData() resolves to a simple field lookup, avoiding
 * multipart encoding differences between jsdom and undici.
 */
function makeRoastRequest(fields: Record<string, unknown>): NextRequest {
  const req = new NextRequest("http://localhost:3000/api/roast", { method: "POST" });
  Object.defineProperty(req, "formData", {
    value: async () => ({ get: (key: string) => fields[key] ?? null }),
  });
  return req;
}

function mockSupabase({ user = null }: { user?: { id: string } | null } = {}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn(),
  };
}

describe("POST /api/roast error paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase() as never);
  });

  it("returns the designed 400 JSON when no file is provided (guest)", async () => {
    const res = await POST(makeRoastRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toMatchObject({
      error: "No file provided",
      code: "INVALID_FILE",
      statusCode: 400,
    });
  });

  it("fires api_error with the anonymous distinct id for guest failures", async () => {
    await POST(makeRoastRequest({ email: "test@example.com" }));

    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "anonymous",
      "api_error",
      expect.objectContaining({
        route: "/api/roast",
        error_code: "FileValidationError",
      })
    );
  });

  it("returns the designed 500 JSON when roast generation fails", async () => {
    mockExtractText.mockResolvedValue({ text: "x".repeat(200), firstName: "Jordan" } as never);
    mockGenerateRoast.mockRejectedValue(new Error("model exploded"));

    const res = await POST(
      makeRoastRequest({ resume: validFileStub, email: "test@example.com" })
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toMatchObject({
      error: "Our AI roaster is having a moment. Please try again in a few seconds.",
      code: "PROCESSING_FAILED",
      statusCode: 500,
    });
  });

  it("fires api_error with the authenticated user's id when generation fails", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase({ user: { id: "user-123" } }) as never);
    mockExtractText.mockResolvedValue({ text: "x".repeat(200), firstName: "Jordan" } as never);
    mockGenerateRoast.mockRejectedValue(new Error("model exploded"));

    await POST(makeRoastRequest({ resume: validFileStub, email: "test@example.com" }));

    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "user-123",
      "api_error",
      expect.objectContaining({ route: "/api/roast" })
    );
    const [distinctId] = mockCaptureServerEvent.mock.calls[0];
    expect(distinctId).toBeDefined();
  });

  it("returns JSON (not a crash) when failure happens before user is resolved", async () => {
    mockCreateClient.mockRejectedValue(new Error("supabase down"));

    const res = await POST(makeRoastRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toMatchObject({ code: "INTERNAL_ERROR", statusCode: 500 });
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "anonymous",
      "api_error",
      expect.objectContaining({ route: "/api/roast", error_code: "Error" })
    );
  });
});

describe("GET /api/roast/[id] error paths", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = new NextRequest("http://localhost:3000/api/roast/abc123");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the designed 500 JSON when the results fetch throws", async () => {
    mockCreateClient.mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockRejectedValue(new Error("query timeout")),
          })),
        })),
      })),
    } as never);

    const res = await GET(req, makeParams("abc123"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch roast" });
  });

  it("returns the designed 500 JSON when failure happens before id is resolved", async () => {
    mockCreateClient.mockRejectedValue(new Error("supabase down"));

    const res = await GET(req, makeParams("abc123"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch roast" });
  });
});
