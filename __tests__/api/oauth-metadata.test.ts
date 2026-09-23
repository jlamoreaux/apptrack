/**
 * @jest-environment node
 */
/**
 * Tests for the OAuth discovery documents:
 * - /.well-known/oauth-authorization-server validates against the MCP SDK's
 *   OAuthMetadataSchema, has the fixed SITE_URL issuer and absolute endpoint
 *   URLs on it whatever host served the request, and the PRD's fields
 * - /.well-known/oauth-protected-resource and its /api/mcp variant validate
 *   against OAuthProtectedResourceMetadataSchema and serve the same body; the
 *   resource follows an accepted request origin and falls back to SITE_URL
 *   for a spoofed Host
 * - CORS (including Allow-Headers) and the 60-second cache on GET, the CORS
 *   preflight, and 404 with either flag off or on a preview deployment
 *
 * jest.setup.js replaces Request/Response with minimal mocks; this suite
 * installs the edge-runtime primitives bundled with Next.js.
 */

import {
  OAuthMetadataSchema,
  OAuthProtectedResourceMetadataSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { AGENT_TOKEN_SCOPES, MCP_RESOURCE_PATH } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_METADATA_CACHE_CONTROL,
  AGENT_OAUTH_METADATA_CORS_HEADERS,
  CANONICAL_MCP_RESOURCE,
} from "@/lib/constants/agent-oauth";
import { SITE_URL } from "@/lib/constants/site-config";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Response = fetchPrimitives.Response;
global.Headers = fetchPrimitives.Headers;

// Imported after the globals above are installed.
const authorizationServer = require("@/app/.well-known/oauth-authorization-server/route");
const protectedResourceRoot = require("@/app/.well-known/oauth-protected-resource/route");
const protectedResourceMcp = require("@/app/.well-known/oauth-protected-resource/api/mcp/route");

const EXTRA_ORIGIN = "https://www.careerotter.io";
const SPOOFED_ORIGIN = "https://evil.example";
const OAUTH_ENV = [
  "CAREEROTTER_ENABLED",
  "CAREEROTTER_MCP_OAUTH_ENABLED",
  "VERCEL_ENV",
  "CAREEROTTER_MCP_EXTRA_ORIGINS",
] as const;
const ALL_AUTH_METHODS = ["none", "client_secret_basic", "client_secret_post"];

const savedEnv: Partial<Record<(typeof OAUTH_ENV)[number], string>> = {};

const PROTECTED_RESOURCE_ROUTES = [
  ["root", protectedResourceRoot, "/.well-known/oauth-protected-resource"],
  ["/api/mcp", protectedResourceMcp, "/.well-known/oauth-protected-resource/api/mcp"],
] as const;

function getRequest(origin: string, path: string): Request {
  return new Request(`${origin}${path}`);
}

function expectMetadataHeaders(response: Response): void {
  for (const [name, value] of Object.entries(AGENT_OAUTH_METADATA_CORS_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
  expect(response.headers.get("Access-Control-Allow-Headers")).toContain("MCP-Protocol-Version");
  expect(response.headers.get("Cache-Control")).toBe(AGENT_OAUTH_METADATA_CACHE_CONTROL);
}

beforeAll(() => {
  for (const name of OAUTH_ENV) savedEnv[name] = process.env[name];
});

afterAll(() => {
  for (const name of OAUTH_ENV) {
    const value = savedEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

beforeEach(() => {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
  delete process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;
});

describe("/.well-known/oauth-authorization-server", () => {
  it("validates against the SDK schema with a fixed SITE_URL issuer", async () => {
    const response: Response = authorizationServer.GET();
    expect(response.status).toBe(200);
    expectMetadataHeaders(response);
    const body = await response.json();
    expect(OAuthMetadataSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      issuer: SITE_URL,
      authorization_endpoint: `${SITE_URL}/oauth/authorize`,
      token_endpoint: `${SITE_URL}/api/oauth/token`,
      registration_endpoint: `${SITE_URL}/api/oauth/register`,
      revocation_endpoint: `${SITE_URL}/api/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ALL_AUTH_METHODS,
      revocation_endpoint_auth_methods_supported: ALL_AUTH_METHODS,
      scopes_supported: [...AGENT_TOKEN_SCOPES],
      authorization_response_iss_parameter_supported: true,
    });
  });

  it("answers the CORS preflight", () => {
    const response: Response = authorizationServer.OPTIONS();
    expect(response.status).toBe(204);
    expectMetadataHeaders(response);
  });
});

describe.each(PROTECTED_RESOURCE_ROUTES)("protected resource metadata (%s)", (_label, route, path) => {
  it("validates against the SDK schema and names the issuer", async () => {
    const response: Response = route.GET(getRequest(SITE_URL, path));
    expect(response.status).toBe(200);
    expectMetadataHeaders(response);
    const body = await response.json();
    expect(OAuthProtectedResourceMetadataSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      resource: CANONICAL_MCP_RESOURCE,
      authorization_servers: [SITE_URL],
      scopes_supported: [...AGENT_TOKEN_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "CareerOtter",
    });
  });

  it("follows an accepted request origin", async () => {
    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = EXTRA_ORIGIN;
    const body = await route.GET(getRequest(EXTRA_ORIGIN, path)).json();
    expect(body.resource).toBe(`${EXTRA_ORIGIN}${MCP_RESOURCE_PATH}`);
    expect(body.authorization_servers).toEqual([SITE_URL]);
  });

  it("falls back to SITE_URL for a spoofed Host", async () => {
    const body = await route.GET(getRequest(SPOOFED_ORIGIN, path)).json();
    expect(body.resource).toBe(CANONICAL_MCP_RESOURCE);
  });

  it("answers the CORS preflight", () => {
    const response: Response = route.OPTIONS();
    expect(response.status).toBe(204);
    expectMetadataHeaders(response);
  });
});

it("serves the same body at the root and at /api/mcp", async () => {
  const [root, mcp] = await Promise.all(
    PROTECTED_RESOURCE_ROUTES.map(([, route, path]) => route.GET(getRequest(SITE_URL, path)).json())
  );
  expect(root).toEqual(mcp);
});

describe("the issuer and endpoints are fixed on every host", () => {
  it("is identical whatever the request host", async () => {
    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = EXTRA_ORIGIN;
    const body = await authorizationServer.GET().json();
    for (const value of Object.values(body)) {
      if (typeof value === "string" && value.startsWith("http")) {
        expect(value.startsWith(SITE_URL)).toBe(true);
      }
    }
  });
});

describe("gating", () => {
  it.each([
    ["CAREEROTTER_MCP_OAUTH_ENABLED off", () => delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED],
    ["CAREEROTTER_ENABLED off", () => delete process.env.CAREEROTTER_ENABLED],
    ["a preview deployment", () => (process.env.VERCEL_ENV = "preview")],
  ])("404 on every document with %s", (_label, disable) => {
    disable();
    expect(authorizationServer.GET().status).toBe(404);
    expect(authorizationServer.OPTIONS().status).toBe(404);
    for (const [, route, path] of PROTECTED_RESOURCE_ROUTES) {
      expect(route.GET(getRequest(SITE_URL, path)).status).toBe(404);
      expect(route.OPTIONS().status).toBe(404);
    }
  });
});
