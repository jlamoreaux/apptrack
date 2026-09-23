/**
 * @jest-environment node
 */
/**
 * Tests for GET /api/cron/agent-oauth-cleanup:
 * - requires cron auth; 404 with CAREEROTTER_ENABLED off; runs with the
 *   OAuth flag off
 * - calls delete_expired_agent_oauth_rows and returns and logs its counts,
 *   with a security log for idle revocations
 * - batches: calls again while any count fills a batch, sums the counts, and
 *   stops at the round limit (logged as a backlog)
 * - a missing function (42883, or PostgREST's PGRST202) is a 200 no-op
 * - any other failure -> 500, logged at error level with what earlier rounds
 *   did
 * - vercel.json schedules it daily
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { loggerService } from "@/lib/services/logger.service";
import { AGENT_OAUTH_CLEANUP, AGENT_OAUTH_PATHS, AGENT_OAUTH_RPC } from "@/lib/constants/agent-oauth";
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

type RpcResult = { data: unknown; error: unknown };

/** Every call answers `result`; or, given several, one each in turn (the last repeating). */
function rpcResolving(...results: RpcResult[]): jest.Mock {
  let call = 0;
  const rpc = jest.fn(() => {
    const result = results[Math.min(call, results.length - 1)];
    call++;
    return { single: () => Promise.resolve(result) };
  });
  mockAdmin.mockReturnValue({ rpc });
  return rpc;
}

const FULL_BATCH = { ...COUNTS, access_tokens_deleted: AGENT_OAUTH_CLEANUP.batchSize };

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
  expect(await response.json()).toEqual({ ...COUNTS, rounds: 1, complete: true });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith(AGENT_OAUTH_RPC.deleteExpiredRows);
  expect(loggerService.info).toHaveBeenCalledWith(
    "OAuth cleanup complete",
    expect.objectContaining({ metadata: { ...COUNTS, rounds: 1, complete: true } })
  );
  expect(loggerService.info).toHaveBeenCalledWith(
    "OAuth grants revoked as idle",
    expect.objectContaining({ metadata: { count: COUNTS.idle_grants_revoked } })
  );
});

it("calls again while a rule fills its batch, and sums the counts", async () => {
  const rpc = rpcResolving({ data: FULL_BATCH, error: null }, { data: COUNTS, error: null });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(await response.json()).toEqual({
    idle_grants_revoked: 2 * COUNTS.idle_grants_revoked,
    codes_deleted: 2 * COUNTS.codes_deleted,
    access_tokens_deleted: AGENT_OAUTH_CLEANUP.batchSize + COUNTS.access_tokens_deleted,
    refresh_tokens_deleted: 2 * COUNTS.refresh_tokens_deleted,
    clients_deleted: 2 * COUNTS.clients_deleted,
    rounds: 2,
    complete: true,
  });
});

it("stops at the round limit and logs the backlog", async () => {
  const rpc = rpcResolving({ data: FULL_BATCH, error: null });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(AGENT_OAUTH_CLEANUP.maxRounds);
  expect(await response.json()).toMatchObject({ rounds: AGENT_OAUTH_CLEANUP.maxRounds, complete: false });
  expect(loggerService.warn).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ action: "mcp_oauth_cleanup_backlog" })
  );
});

it("500 with an error log carrying earlier rounds' counts when a later call fails", async () => {
  rpcResolving({ data: FULL_BATCH, error: null }, { data: null, error: { code: "57014", message: "statement timeout" } });
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(loggerService.error).toHaveBeenCalledWith(
    "OAuth cleanup run failed",
    undefined,
    expect.objectContaining({
      action: "mcp_oauth_cleanup_run_failed",
      metadata: { ...FULL_BATCH, rounds: 1 },
    })
  );
});

it.each(["42883", "PGRST202"])("treats a missing function (%s) as a no-op", async (code) => {
  rpcResolving({ data: null, error: { code, message: "function does not exist" } });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ skipped: expect.stringContaining("045") });
  expect(loggerService.error).not.toHaveBeenCalled();
});

it("500 when the cleanup fails, logged at error level", async () => {
  rpcResolving({ data: null, error: { code: "XX000", message: "boom" } });
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(loggerService.error).toHaveBeenCalledWith(
    "OAuth cleanup run failed",
    undefined,
    expect.objectContaining({ action: "mcp_oauth_cleanup_run_failed", metadata: expect.objectContaining({ rounds: 0 }) })
  );
});

it("500 when the result has an unexpected shape", async () => {
  rpcResolving({ data: { codes_deleted: "many" }, error: null });
  expect((await GET(request())).status).toBe(500);
});

it("is scheduled daily in vercel.json", () => {
  const entry = vercelConfig.crons.find((cron) => cron.path === AGENT_OAUTH_PATHS.cleanupCron);
  expect(entry?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
});
