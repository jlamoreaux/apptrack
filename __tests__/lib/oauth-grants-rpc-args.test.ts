// @jest-environment node
/**
 * The grant revoke calls must name their RPC arguments exactly as migration
 * 045 declares them. PostgREST resolves a function by name and argument
 * names, so a mismatch fails with PGRST202, which revokeAllAgentGrants reads
 * as "045 not applied yet" and reports as 0 revoked instead of failing.
 */

import { readFileSync } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revokeAgentGrant, revokeAllAgentGrants } from "@/lib/auth/oauth/grants";
import { AGENT_OAUTH_RPC } from "@/lib/constants/agent-oauth";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const MIGRATION = readFileSync(
  path.join(__dirname, "../../schemas/migrations/045_mcp_oauth.sql"),
  "utf8"
);
const USER_ID = "11111111-2222-4333-8444-555555555555";
const GRANT_ID = "aaaaaaaa-2222-4333-8444-555555555555";

/** The input (non-OUT) parameter names of a function created in 045. */
function sqlInputParams(functionName: string): string[] {
  const match = new RegExp(
    `create or replace function public\\.${functionName}\\s*\\(([^)]*)\\)`,
    "i"
  ).exec(MIGRATION);
  if (!match) throw new Error(`${functionName} is not defined in 045`);
  return match[1]
    .split(",")
    .map((param) => param.trim())
    .filter((param) => param !== "" && !/^(out|inout)\s/i.test(param))
    .map((param) => param.replace(/^in\s+/i, "").split(/\s+/)[0])
    .sort();
}

function mockAdmin(data: unknown): { admin: SupabaseClient; rpc: jest.Mock } {
  const single = jest.fn().mockResolvedValue({ data, error: null });
  const rpc = jest.fn(() => {
    const call = Promise.resolve({ data, error: null });
    return Object.assign(call, { single });
  });
  // Only rpc is reached by these calls.
  const admin = { rpc } as unknown as SupabaseClient;
  return { admin, rpc };
}

function argNames(rpc: jest.Mock): string[] {
  const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
  return Object.keys(args).sort();
}

describe("grant RPC arguments match migration 045", () => {
  it("parses the migration's parameter lists", () => {
    expect(sqlInputParams(AGENT_OAUTH_RPC.revokeGrant)).toEqual(["p_grant_id", "p_reason", "p_user_id"]);
    expect(sqlInputParams(AGENT_OAUTH_RPC.revokeAllGrants)).toEqual(["p_user_id"]);
  });

  it("revokeAgentGrant", async () => {
    const { admin, rpc } = mockAdmin({ outcome: "revoked", grant_id: GRANT_ID });
    const result = await revokeAgentGrant(admin, USER_ID, GRANT_ID);
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(AGENT_OAUTH_RPC.revokeGrant, expect.any(Object));
    expect(argNames(rpc)).toEqual(sqlInputParams(AGENT_OAUTH_RPC.revokeGrant));
  });

  it("revokeAllAgentGrants", async () => {
    const { admin, rpc } = mockAdmin(1);
    const result = await revokeAllAgentGrants(admin, USER_ID);
    expect(result).toEqual(expect.objectContaining({ ok: true, value: 1 }));
    expect(rpc).toHaveBeenCalledWith(AGENT_OAUTH_RPC.revokeAllGrants, expect.any(Object));
    expect(argNames(rpc)).toEqual(sqlInputParams(AGENT_OAUTH_RPC.revokeAllGrants));
  });
});
