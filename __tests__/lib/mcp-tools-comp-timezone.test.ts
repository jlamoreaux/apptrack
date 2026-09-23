/**
 * @jest-environment node
 */
/**
 * resolveAsOf without an as_of must measure vesting at an instant whose local
 * date is today's UTC date, whatever zone the server runs in. Near a year
 * boundary in a zone ahead of UTC, measuring at the raw request time would
 * already be "next year" locally and pass a cliff the UTC date has not reached.
 *
 * Jest hands each test file a copy of process.env, so assigning TZ inside a
 * test never reaches Node's clock (the local offset stays unchanged). The
 * assertion therefore runs in a child Jest process started with TZ set.
 */

import { spawnSync } from "child_process";
import path from "path";
import { COMP_TOOLS } from "@/lib/mcp/tools/comp";
import { listCompEntries, type StoredCompEntry } from "@/lib/careerotter/comp-service";
import { readValidCachedQuotes } from "@/lib/careerotter/stock-price-cache";
import { call, recordField, structuredOf } from "@/__tests__/utils/test-helpers/mcp-client";
import type { McpMocks } from "@/__tests__/utils/test-helpers/mcp-mocks";

jest.mock("@/lib/analytics/posthog-server", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").posthogServerMock()
);
jest.mock("@/lib/services/logger.service", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").loggerServiceMock()
);
jest.mock("@/lib/careerotter/comp-service", () => ({
  ...jest.requireActual<object>("@/lib/careerotter/comp-service"),
  listCompEntries: jest.fn(),
}));
jest.mock("@/lib/careerotter/stock-price-cache", () => ({
  ...jest.requireActual<object>("@/lib/careerotter/stock-price-cache"),
  readValidCachedQuotes: jest.fn(),
}));

const PROBE_ZONE = "Asia/Tokyo";
// Tokyo is UTC+9 with no daylight saving time.
const PROBE_ZONE_OFFSET_MINUTES = -9 * 60;
const CHILD_TIMEOUT_MS = 120_000;
const REPO_ROOT = path.resolve(__dirname, "../..");
const inProbeZone = process.env.TZ === PROBE_ZONE;

// 05:00 on Jan 1 in Tokyo, still Dec 31 in UTC.
const NOW = new Date("2026-12-31T20:00:00Z");

const GRANT: StoredCompEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  effective_date: "2026-01-01",
  base: 150_000,
  bonus: 0,
  equity: 48_000,
  currency: "USD",
  note: null,
  ticker: null,
  shares: 1000,
  vest_start: "2026-01-01",
  vest_years: 4,
  vest_cliff_months: 12,
  source: "manual",
  external_ref: null,
  updated_at: null,
  created_at: "2026-01-01T10:00:00.000Z",
};

(inProbeZone ? describe : describe.skip)(`default as_of in ${PROBE_ZONE}`, () => {
  beforeEach(() => {
    jest.mocked(listCompEntries).mockResolvedValue({ ok: true, value: [GRANT] });
    jest.mocked(readValidCachedQuotes).mockResolvedValue({ ok: true, value: {} });
  });

  it("runs with the zone applied", () => {
    expect(NOW.getTimezoneOffset()).toBe(PROBE_ZONE_OFFSET_MINUTES);
  });

  it("has not passed a Jan 1 cliff while the UTC date is still Dec 31", async () => {
    const result = await call({ tools: COMP_TOOLS, now: NOW }, "get_comp_summary", {}, ["comp:read"]);
    const structured = structuredOf(result);
    expect(structured.as_of).toBe("2026-12-31");
    const vest = recordField(recordField(structured, "current"), "vest");
    expect(vest).toMatchObject({
      cliff_date: "2027-01-01",
      cliff_passed: false,
      vested_fraction: 0,
      vested_value: 0,
    });
  });
});

(inProbeZone ? describe.skip : describe)("default as_of across time zones", () => {
  it(`passes in ${PROBE_ZONE}`, () => {
    const child = spawnSync(
      process.execPath,
      [require.resolve("jest/bin/jest"), "--ci", "--runTestsByPath", __filename],
      { cwd: REPO_ROOT, env: { ...process.env, TZ: PROBE_ZONE }, encoding: "utf8" }
    );
    const output = `${child.stdout}\n${child.stderr}`;
    expect({ status: child.status, output }).toMatchObject({ status: 0 });
    expect(output).toMatch(/Tests:.*2 passed/);
    expect(output).not.toMatch(/failed/);
  }, CHILD_TIMEOUT_MS);
});
