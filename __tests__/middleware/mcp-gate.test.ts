/**
 * @jest-environment node
 */
/**
 * Launch gate for the MCP route in proxy.ts:
 * - /api/mcp and /api/mcp/* 404 while CAREEROTTER_ENABLED is unset
 * - when enabled they pass straight through (NextResponse.next) without the
 *   Supabase session refresh or the legacy-host redirect
 * - the matcher covers both paths
 */

import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveLegacyRedirect } from "@/lib/rebrand-redirect";

const NEXT_RESPONSE = { passThrough: true };

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    constructor(_body: unknown, init?: { status?: number }) {
      this.status = init?.status ?? 200;
    }
    static next = jest.fn(() => NEXT_RESPONSE);
    static redirect = jest.fn();
    static rewrite = jest.fn();
  }
  return { NextResponse: MockNextResponse };
});
jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("@/lib/rebrand-redirect", () => ({ resolveLegacyRedirect: jest.fn(() => null) }));

const { proxy, config } = require("@/proxy");

function mcpRequest(pathname: string): NextRequest {
  const url = new URL(`https://careerotter.io${pathname}`);
  const request = {
    method: "POST",
    url: url.toString(),
    nextUrl: url,
    headers: new Headers({ host: "apptrack.ing", accept: "application/json, text/event-stream" }),
  };
  return request as unknown as NextRequest;
}

const ORIGINAL_FLAG = process.env.CAREEROTTER_ENABLED;

afterEach(() => {
  jest.clearAllMocks();
  if (ORIGINAL_FLAG === undefined) delete process.env.CAREEROTTER_ENABLED;
  else process.env.CAREEROTTER_ENABLED = ORIGINAL_FLAG;
});

describe("MCP launch gate", () => {
  it.each(["/api/mcp", "/api/mcp/extra"])("404s %s when CAREEROTTER_ENABLED is unset", async (path) => {
    delete process.env.CAREEROTTER_ENABLED;
    const response = await proxy(mcpRequest(path));
    expect(response.status).toBe(404);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it.each(["/api/mcp", "/api/mcp/extra"])(
    "passes %s through without Supabase or legacy redirects when enabled",
    async (path) => {
      process.env.CAREEROTTER_ENABLED = "1";
      const response = await proxy(mcpRequest(path));
      expect(response).toBe(NEXT_RESPONSE);
      expect(createServerClient).not.toHaveBeenCalled();
      expect(resolveLegacyRedirect).not.toHaveBeenCalled();
    }
  );

  it("does not gate a path that only shares the prefix", async () => {
    delete process.env.CAREEROTTER_ENABLED;
    const response = await proxy(mcpRequest("/api/mcpx"));
    expect(response.status).not.toBe(404);
  });

  it("matches /api/mcp and its subpaths", () => {
    expect(config.matcher).toEqual(expect.arrayContaining(["/api/mcp", "/api/mcp/:path*"]));
  });
});
