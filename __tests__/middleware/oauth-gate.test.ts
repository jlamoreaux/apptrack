/**
 * @jest-environment node
 */
/**
 * OAuth gate in middleware.ts, for every combination of CAREEROTTER_ENABLED,
 * CAREEROTTER_MCP_OAUTH_ENABLED and a Vercel preview:
 * - the OAuth pages, API and discovery documents 404 unless
 *   isMcpOAuthEnabled() (both flags on, not a preview)
 * - the cleanup cron 404s only while CAREEROTTER_ENABLED is off
 * - when enabled, /api/oauth/* and /.well-known/oauth-* pass straight through
 *   without the Supabase session refresh or the legacy-host redirect, while
 *   the /oauth/* pages keep the session refresh
 * - other /.well-known documents are never gated
 * - the matcher reaches every one of these paths
 */

import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveLegacyRedirect } from "@/lib/rebrand-redirect";
import { AGENT_OAUTH_PATHS } from "@/lib/constants/agent-oauth";

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
jest.mock("@/lib/rebrand-redirect", () => ({
  ...jest.requireActual("@/lib/rebrand-redirect"),
  resolveLegacyRedirect: jest.fn(() => null),
}));

const { middleware, config } = require("@/middleware");
const { unstable_doesMiddlewareMatch } = require("next/experimental/testing/server");

const mockCreateServerClient = createServerClient as jest.Mock;

const OAUTH_PAGES = [AGENT_OAUTH_PATHS.authorize, AGENT_OAUTH_PATHS.consent, AGENT_OAUTH_PATHS.error];
const OAUTH_MACHINE_PATHS = [
  AGENT_OAUTH_PATHS.protectedResourceMetadata,
  AGENT_OAUTH_PATHS.protectedResourceMetadataRoot,
  AGENT_OAUTH_PATHS.authorizationServerMetadata,
  AGENT_OAUTH_PATHS.register,
  AGENT_OAUTH_PATHS.consentDecision,
  AGENT_OAUTH_PATHS.token,
  AGENT_OAUTH_PATHS.revoke,
];
const OAUTH_SURFACES = [...OAUTH_PAGES, ...OAUTH_MACHINE_PATHS];

interface Flags {
  careerotter: boolean;
  oauth: boolean;
  preview: boolean;
}

// Every combination; OAuth is on only for the first.
const FLAG_MATRIX: [Flags, boolean][] = [
  [{ careerotter: true, oauth: true, preview: false }, true],
  [{ careerotter: true, oauth: true, preview: true }, false],
  [{ careerotter: true, oauth: false, preview: false }, false],
  [{ careerotter: true, oauth: false, preview: true }, false],
  [{ careerotter: false, oauth: true, preview: false }, false],
  [{ careerotter: false, oauth: true, preview: true }, false],
  [{ careerotter: false, oauth: false, preview: false }, false],
  [{ careerotter: false, oauth: false, preview: true }, false],
];

const ORIGINAL_ENV = { ...process.env };

function setFlags({ careerotter, oauth, preview }: Flags): void {
  process.env = { ...ORIGINAL_ENV };
  if (careerotter) process.env.CAREEROTTER_ENABLED = "1";
  else delete process.env.CAREEROTTER_ENABLED;
  if (oauth) process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  else delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
  if (preview) process.env.VERCEL_ENV = "preview";
  else delete process.env.VERCEL_ENV;
}

function request(pathname: string, method = "GET"): NextRequest {
  const url = new URL(`https://careerotter.io${pathname}`);
  return {
    method,
    url: url.toString(),
    nextUrl: url,
    headers: new Headers({ host: "careerotter.io", accept: "text/html" }),
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockCreateServerClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe.each(FLAG_MATRIX)("with flags %j", (flags, oauthEnabled) => {
  beforeEach(() => setFlags(flags));

  it.each(OAUTH_SURFACES)(`${oauthEnabled ? "serves" : "404s"} %s`, async (path) => {
    const response = await middleware(request(path));
    if (oauthEnabled) expect(response.status).not.toBe(404);
    else expect(response.status).toBe(404);
  });

  it(`${flags.careerotter ? "serves" : "404s"} the cleanup cron`, async () => {
    const response = await middleware(request(AGENT_OAUTH_PATHS.cleanupCron));
    if (flags.careerotter) expect(response.status).not.toBe(404);
    else expect(response.status).toBe(404);
  });

  it("never gates other /.well-known documents", async () => {
    const response = await middleware(request("/.well-known/api-catalog"));
    expect(response.status).not.toBe(404);
  });
});

describe("with OAuth enabled", () => {
  beforeEach(() => setFlags({ careerotter: true, oauth: true, preview: false }));

  it.each(OAUTH_MACHINE_PATHS)(
    "passes %s through without Supabase or legacy redirects",
    async (path) => {
      const response = await middleware(request(path, "POST"));
      expect(response).toBe(NEXT_RESPONSE);
      expect(mockCreateServerClient).not.toHaveBeenCalled();
      expect(resolveLegacyRedirect).not.toHaveBeenCalled();
    }
  );

  it.each(OAUTH_PAGES)("refreshes the Supabase session for the page %s", async (path) => {
    const response = await middleware(request(path));
    expect(response).toBe(NEXT_RESPONSE);
    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
  });
});

describe("with OAuth disabled", () => {
  beforeEach(() => setFlags({ careerotter: true, oauth: false, preview: false }));

  it.each(["/oauthx", "/api/oauthx", "/.well-known/openid-configuration"])(
    "does not gate %s, which only shares a prefix",
    async (path) => {
      const response = await middleware(request(path));
      expect(response.status).not.toBe(404);
    }
  );
});

describe("matcher", () => {
  it.each([...OAUTH_SURFACES, AGENT_OAUTH_PATHS.cleanupCron])("runs the middleware for %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it("lists the OAuth API and the cleanup cron explicitly", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining(["/api/oauth/:path*", AGENT_OAUTH_PATHS.cleanupCron])
    );
  });
});
