/**
 * @jest-environment node
 *
 * Share-link minting: gated, authenticated, fails closed without a secret, and
 * only publishes the company when the owner opts in.
 */
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/year-in-review/share/route";
import { getUser } from "@/lib/supabase/server";
import { loadYearInReview } from "@/lib/year-in-review/load";
import { computeYearInReview } from "@/lib/year-in-review/compute";
import { decodeShareToken } from "@/lib/year-in-review/share-token";
import { EMPTY_ACTIVITY } from "@/lib/year-in-review/types";

jest.mock("@/lib/supabase/server", () => ({ getUser: jest.fn() }));
jest.mock("@/lib/year-in-review/load", () => ({ loadYearInReview: jest.fn() }));
jest.mock("@/lib/analytics/posthog-server", () => ({ captureServerEvent: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetUser = getUser as jest.Mock;
const mockLoad = loadYearInReview as jest.Mock;
const SECRET = "x".repeat(48);
const originalEnv = { ...process.env };

const stats = computeYearInReview({
  year: 2026,
  asOf: new Date("2026-12-05T00:00:00Z"),
  applications: [
    { id: "1", company: "Acme", role: "Designer", status: "Hired", date_applied: "2026-03-02" },
  ],
  history: [],
  activity: EMPTY_ACTIVITY,
});

// The route only reads the JSON body. jest.setup.js mocks next/server globally.
function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    YEAR_IN_REVIEW_ENABLED: "1",
    YEAR_IN_REVIEW_SHARE_SECRET: SECRET,
    NEXT_PUBLIC_APP_URL: "https://careerotter.io",
  };
  mockGetUser.mockResolvedValue({ id: "user-1" });
  mockLoad.mockResolvedValue(stats);
});

afterAll(() => {
  process.env = originalEnv;
});

function tokenFrom(url: string): string {
  return url.replace("https://careerotter.io/year-in-review/", "");
}

describe("POST /api/year-in-review/share", () => {
  it("404s while the feature is off", async () => {
    delete process.env.YEAR_IN_REVIEW_ENABLED;
    expect((await POST(request({ year: 2026 }))).status).toBe(404);
  });

  it("requires a signed-in user", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await POST(request({ year: 2026 }))).status).toBe(401);
  });

  it("fails closed without a share secret", async () => {
    delete process.env.YEAR_IN_REVIEW_SHARE_SECRET;
    expect((await POST(request({ year: 2026 }))).status).toBe(503);
  });

  it("rejects an invalid year", async () => {
    expect((await POST(request({ year: 1999 }))).status).toBe(400);
    expect((await POST(request({ year: "2026" }))).status).toBe(400);
  });

  it("mints a verifiable link from server-computed stats, without the company by default", async () => {
    const response = await POST(request({ year: 2026 }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mockLoad).toHaveBeenCalledWith("user-1", 2026);
    expect(body.storyImageUrl).toBe(`${body.url}/story`);

    const payload = decodeShareToken(tokenFrom(body.url), SECRET);
    expect(payload).toMatchObject({ y: 2026, a: 1, o: 1 });
    // Whether they were hired is part of the opt-in, not the default payload.
    expect(payload).not.toHaveProperty("h");
    expect(payload?.hc).toBeUndefined();
  });

  it("includes the company only when asked", async () => {
    const body = await (await POST(request({ year: 2026, includeOutcome: true }))).json();
    expect(decodeShareToken(tokenFrom(body.url), SECRET)?.hc).toBe("Acme");
  });

  it("refuses to share an empty year", async () => {
    mockLoad.mockResolvedValue({ ...stats, volume: { ...stats.volume, applications: 0 } });
    expect((await POST(request({ year: 2026 }))).status).toBe(400);
  });
});
