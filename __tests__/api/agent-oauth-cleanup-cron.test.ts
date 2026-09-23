/**
 * @jest-environment node
 */
/**
 * Tests for GET /api/cron/agent-oauth-cleanup:
 * - requires cron auth; 404 with CAREEROTTER_ENABLED off; runs with the
 *   OAuth flag off
 * - calls delete_expired_agent_oauth_rows and returns and logs its counts,
 *   with a security log for idle revocations
 * - a missing function (42883, or PostgREST's PGRST202) is a 200 no-op
 * - any other failure -> 500
 * - vercel.json schedules it daily
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { loggerService } from "@/lib/services/logger.service";
import { AGENT_OAUTH_PATHS, AGENT_OAUTH_RPC } from "@/lib/constants/agent-oauth";
import vercelConfig from "@/vercel.json";

jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/email/lifecycle-cron", () => ({ verifyCronAuth: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { GET } = require("@/app/api/cron/agent-oauth-cleanup/route");

const mockAdmin = createAdminClient as jest.Mock;
const mockAuth = verifyCronAuth as jest.Mock;

const COUNTS = {
  idle_grants_revoked: 2,
  codes_deleted: 5,
  access_tokens_deleted: 7,
  refresh_tokens_deleted: 3,
  clients_deleted: 4,
};
const ENV = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED"] as const;
const savedEnv: Partial<Record<(typeof ENV)[number], string>> = {};

function rpcResolving(result: { data: unknown; error: unknown }): jest.Mock {
  const rpc = jest.fn(() => ({ single: () => Promise.resolve(result) }));
  mockAdmin.mockReturnValue({ rpc });
  return rpc;
}

function request(): NextRequest {
  return new NextRequest(`https://careerotter.io${AGENT_OAUTH_PATHS.cleanupCron}`, {
    headers: { authorization: "Bearer secret" },
  });
}

beforeAll(() => {
  for (const name of ENV) savedEnv[name] = process.env[name];
});

afterAll(() => {
  for (const name of ENV) {
    const value = savedEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CAREEROTTER_ENABLED = "1";
  delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
  mockAuth.mockReturnValue(true);
});

it("401 without cron auth, and no cleanup", async () => {
  mockAuth.mockReturnValue(false);
  const rpc = rpcResolving({ data: COUNTS, error: null });
  const response = await GET(request());
  expect(response.status).toBe(401);
  expect(mockAuth).toHaveBeenCalledWith(expect.anything(), AGENT_OAUTH_PATHS.cleanupCron);
  expect(rpc).not.toHaveBeenCalled();
});

it("404 with CAREEROTTER_ENABLED off", async () => {
  delete process.env.CAREEROTTER_ENABLED;
  const rpc = rpcResolving({ data: COUNTS, error: null });
  expect((await GET(request())).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
});

it("runs the cleanup with the OAuth flag off and returns its counts", async () => {
  const rpc = rpcResolving({ data: COUNTS, error: null });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(COUNTS);
  expect(rpc).toHaveBeenCalledWith(AGENT_OAUTH_RPC.deleteExpiredRows);
  expect(loggerService.info).toHaveBeenCalledWith(
    "OAuth cleanup complete",
    expect.objectContaining({ metadata: COUNTS })
  );
  expect(loggerService.info).toHaveBeenCalledWith(
    "OAuth grants revoked as idle",
    expect.objectContaining({ metadata: { count: COUNTS.idle_grants_revoked } })
  );
});

it.each(["42883", "PGRST202"])("treats a missing function (%s) as a no-op", async (code) => {
  rpcResolving({ data: null, error: { code, message: "function does not exist" } });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ skipped: expect.stringContaining("045") });
  expect(loggerService.error).not.toHaveBeenCalled();
});

it("500 when the cleanup fails", async () => {
  rpcResolving({ data: null, error: { code: "XX000", message: "boom" } });
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(loggerService.error).toHaveBeenCalled();
});

it("500 when the result has an unexpected shape", async () => {
  rpcResolving({ data: { codes_deleted: "many" }, error: null });
  expect((await GET(request())).status).toBe(500);
});

it("is scheduled daily in vercel.json", () => {
  const entry = vercelConfig.crons.find((cron) => cron.path === AGENT_OAUTH_PATHS.cleanupCron);
  expect(entry?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
});
