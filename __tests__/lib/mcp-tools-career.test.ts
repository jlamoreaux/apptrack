/**
 * @jest-environment node
 */
/**
 * get_career_context (lib/mcp/tools/career.ts) through a real McpServer and
 * SDK client, with the career profile service mocked:
 * - registered only for career:read
 * - profile fields plus the review countdown from as_of (default: ctx.now)
 * - no profile → has_profile false with nulls
 * - invalid as_of and service failures → isError
 */

import { CAREER_TOOLS } from "@/lib/mcp/tools/career";
import {
  getCareerProfileContext,
  type CareerProfileContext,
} from "@/lib/careerotter/career-profile-service";
import { CAREER_MODES, CAREER_MODE_GOAL_LABEL } from "@/lib/constants/careerotter";
import { MCP_AS_OF_MESSAGE } from "@/lib/constants/mcp-tools";
import {
  INVALID_ARGUMENTS,
  TEST_ADMIN,
  TEST_USER_ID,
  call as callTool,
  errorTextOf,
  listTools,
  registeredCount,
  structuredOf,
  textOf,
  toolNames,
  type CallResult,
  type McpHarness,
} from "@/__tests__/utils/test-helpers/mcp-client";
import type { McpMocks } from "@/__tests__/utils/test-helpers/mcp-mocks";

jest.mock("@/lib/careerotter/career-profile-service", () => ({
  getCareerProfileContext: jest.fn(),
}));
jest.mock("@/lib/analytics/posthog-server", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").posthogServerMock()
);
jest.mock("@/lib/services/logger.service", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").loggerServiceMock()
);

const mockGetProfile = jest.mocked(getCareerProfileContext);

const HARNESS: McpHarness = { tools: CAREER_TOOLS, scopes: ["career:read"] };

const PROFILE: CareerProfileContext = {
  mode: "promotion",
  role: "Software Engineer",
  level: "L4",
  time_in_role: "2 years",
  target: "Senior",
  review_date: "2026-10-01",
};

function call(args: Record<string, unknown> = {}): Promise<CallResult> {
  return callTool(HARNESS, "get_career_context", args);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scope gating", () => {
  it("registers get_career_context only for career:read", async () => {
    expect(await toolNames(HARNESS, ["career:read"])).toEqual(["get_career_context"]);
    expect(registeredCount(CAREER_TOOLS, ["wins:write", "comp:write"])).toBe(0);
  });

  it("names every career mode in the description", async () => {
    const [tool] = await listTools(HARNESS, ["career:read"]);
    expect(tool.description).toContain(CAREER_MODES.join(", "));
  });
});

describe("get_career_context", () => {
  it("returns the profile and a countdown from today (UTC) by default", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const result = await call();
    expect(mockGetProfile).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID);
    expect(structuredOf(result)).toEqual({
      has_profile: true,
      as_of: "2026-09-01",
      ...PROFILE,
      review_countdown: { weeks: 4, days: 30, is_past: false, label: "Review in 4 weeks" },
    });
    expect(textOf(result)).toBe("Review in 4 weeks.");
  });

  it("counts down from as_of when given", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const result = await call({ as_of: "2026-09-30" });
    expect(structuredOf(result)).toMatchObject({
      as_of: "2026-09-30",
      review_countdown: { weeks: 0, days: 1, is_past: false, label: "Review is tomorrow" },
    });
  });

  it("reports a passed date", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: PROFILE });
    const result = await call({ as_of: "2026-10-05" });
    expect(structuredOf(result)).toMatchObject({
      review_countdown: { days: 4, is_past: true, label: "Review date passed" },
    });
  });

  it("uses the target noun in job_search mode", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: { ...PROFILE, mode: "job_search" } });
    const result = await call({ as_of: "2026-10-01" });
    expect(structuredOf(result)).toMatchObject({
      review_countdown: { label: "Target is today" },
    });
  });

  it("counts down to the review in raise mode", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: { ...PROFILE, mode: "raise" } });
    const result = await call({ as_of: "2026-09-24" });
    expect(structuredOf(result)).toMatchObject({
      mode: "raise",
      review_countdown: { days: 7, is_past: false, label: "Review in 7 days" },
    });
  });

  it("names the goal in the summary when no review date is set", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: { ...PROFILE, mode: "raise", review_date: null } });
    const result = await call();
    expect(structuredOf(result)).toMatchObject({ review_date: null, review_countdown: null });
    expect(textOf(result)).toBe(`Goal: ${CAREER_MODE_GOAL_LABEL.raise}.`);
  });

  it("returns has_profile false with nulls when there is no profile", async () => {
    mockGetProfile.mockResolvedValue({ ok: true, value: null });
    const result = await call();
    expect(structuredOf(result)).toEqual({
      has_profile: false,
      as_of: "2026-09-01",
      mode: null,
      role: null,
      level: null,
      time_in_role: null,
      target: null,
      review_date: null,
      review_countdown: null,
    });
    expect(textOf(result)).toBe("No career profile set up yet.");
  });

  it.each(["2026-02-30", "09/01/2026", "tomorrow", "1969-12-31"])("rejects as_of %s", async (asOf) => {
    const text = errorTextOf(await call({ as_of: asOf }));
    expect(text).toMatch(INVALID_ARGUMENTS);
    expect(text).toContain(MCP_AS_OF_MESSAGE);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("maps a service failure to isError with its message", async () => {
    mockGetProfile.mockResolvedValue({ ok: false, kind: "db", message: "Failed to load career profile" });
    expect(errorTextOf(await call())).toBe("Failed to load career profile");
  });
});
