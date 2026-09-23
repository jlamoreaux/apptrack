// @jest-environment node
/**
 * Tests for resolveConsentPage (app/oauth/consent/page.tsx's decisions):
 * - OAuth disabled -> not found
 * - revalidation: an unknown client -> /oauth/error, a lookup failure ->
 *   the unavailable card, a redirect error -> the client
 * - signed out -> login with this consent URL as redirectTo
 * - a new account -> onboarding with this consent URL (plus onboarded=1) as
 *   next; returning with the marker shows consent even if the account still
 *   looks new, so there's no loop; the marker isn't carried in the canonical
 *   params; an existing account sees consent
 * - the view: the return destination, the requested scopes, the canonical
 *   params, client_uri only on the redirect's https host, the replace note
 *   and the cap (counting only other apps' active grants)
 * - a grant lookup failure -> the unavailable card
 */

import { resolveConsentPage, sameHostClientUri } from "@/lib/auth/oauth/consent-page";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { getSessionUser } from "@/lib/auth/session-user";
import { needsOnboardingBeforeConsent } from "@/lib/utils/user-onboarding";
import {
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_GRANTS_TABLE,
  AGENT_OAUTH_LIMITS,
  CANONICAL_MCP_RESOURCE,
} from "@/lib/constants/agent-oauth";
import type { AgentOAuthConsentView } from "@/types";

jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/auth/session-user", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/utils/user-onboarding", () => ({ needsOnboardingBeforeConsent: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockAdmin = createAdminClient as jest.Mock;
const mockSessionUser = getSessionUser as jest.Mock;
const mockNeedsOnboarding = needsOnboardingBeforeConsent as jest.Mock;

const NOW = new Date("2026-09-23T12:00:00.000Z");
const USER = { id: "11111111-2222-4333-8444-555555555555", email: "me@example.com" };
const CLIENT_ID = "co_client_AAAAAAAAAAAAAAAAAAAAAA";
const OTHER_CLIENT = "co_client_BBBBBBBBBBBBBBBBBBBBBB";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

interface Result {
  data: unknown;
  error: unknown;
}

function clientRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    client_id: CLIENT_ID,
    client_secret_hash: null,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    client_name: "Claude",
    client_uri: "https://claude.ai/about",
    redirect_uris: [REDIRECT],
    created_at: "2026-09-23T11:00:00.000Z",
    first_authorized_at: null,
    ...overrides,
  };
}

function grantRows(clientIds: string[]): Result {
  return { data: clientIds.map((client_id) => ({ client_id })), error: null };
}

/** An admin client whose clients lookup and grants select resolve to the given results. */
function adminWith(client: Result, grants: Result = grantRows([])): Record<string, jest.Mock> {
  const grantsQuery: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "or"]) grantsQuery[method] = jest.fn(() => grantsQuery);
  grantsQuery.then = (resolve: (value: Result) => void) => resolve(grants);
  const clientQuery: Record<string, jest.Mock> = {};
  clientQuery.select = jest.fn(() => clientQuery);
  clientQuery.eq = jest.fn(() => clientQuery);
  clientQuery.abortSignal = jest.fn(() => clientQuery);
  clientQuery.maybeSingle = jest.fn(() => Promise.resolve(client));
  const tables: Record<string, unknown> = {
    [AGENT_OAUTH_CLIENTS_TABLE]: clientQuery,
    [AGENT_OAUTH_GRANTS_TABLE]: grantsQuery,
  };
  const from = jest.fn((table: string) => tables[table]);
  mockAdmin.mockReturnValue({ from });
  return { from, or: grantsQuery.or as jest.Mock };
}

function searchParams(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    state: "xyz",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    resource: CANONICAL_MCP_RESOURCE,
    scope: "wins:read wins:write career:read comp:read comp:write",
    ...overrides,
  };
}

async function renderedView(): Promise<AgentOAuthConsentView> {
  const resolution = await resolveConsentPage(searchParams(), NOW);
  if (resolution.kind !== "render") throw new Error(`expected render, got ${resolution.kind}`);
  return resolution.view;
}

const savedEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
  adminWith({ data: clientRow(), error: null });
  mockSessionUser.mockResolvedValue(USER);
  mockNeedsOnboarding.mockResolvedValue(false);
});

afterAll(() => {
  process.env = savedEnv;
});

describe("resolveConsentPage: routing", () => {
  it("is not found when OAuth is disabled", async () => {
    process.env.VERCEL_ENV = "preview";
    expect(await resolveConsentPage(searchParams(), NOW)).toEqual({ kind: "not_found" });
  });

  it("sends an unknown client to the error page", async () => {
    adminWith({ data: null, error: null });
    expect(await resolveConsentPage(searchParams(), NOW)).toEqual({
      kind: "redirect",
      location: "/oauth/error",
    });
  });

  it("sends a failed lookup to the unavailable card", async () => {
    adminWith({ data: null, error: { message: "down" } });
    expect(await resolveConsentPage(searchParams(), NOW)).toEqual({
      kind: "redirect",
      location: "/oauth/error?reason=unavailable",
    });
  });

  it("sends a redirect error back to the client", async () => {
    const resolution = await resolveConsentPage(searchParams({ code_challenge_method: "plain" }), NOW);
    if (resolution.kind !== "redirect") throw new Error("expected redirect");
    const url = new URL(resolution.location);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(url.searchParams.get("error")).toBe("invalid_request");
  });

  it("sends a signed-out user to login, returning here", async () => {
    mockSessionUser.mockResolvedValue(null);
    const resolution = await resolveConsentPage(searchParams(), NOW);
    if (resolution.kind !== "redirect") throw new Error("expected redirect");
    const redirectTo = new URL(resolution.location, "https://careerotter.io").searchParams.get("redirectTo");
    expect(redirectTo?.startsWith("/oauth/consent?")).toBe(true);
    expect(mockNeedsOnboarding).not.toHaveBeenCalled();
  });

  it("sends a new account through onboarding with this consent URL as next", async () => {
    mockNeedsOnboarding.mockResolvedValue(true);
    const resolution = await resolveConsentPage(searchParams(), NOW);
    if (resolution.kind !== "redirect") throw new Error("expected redirect");
    const url = new URL(resolution.location, "https://careerotter.io");
    expect(url.pathname).toBe("/onboarding/welcome");
    const next = url.searchParams.get("next") ?? "";
    const consent = new URL(next, "https://careerotter.io");
    expect(consent.pathname).toBe("/oauth/consent");
    expect(consent.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(mockNeedsOnboarding).toHaveBeenCalledWith(USER.id);
  });

  it("doesn't loop: back from onboarding, consent renders even though the account still looks new", async () => {
    mockNeedsOnboarding.mockResolvedValue(true);
    const first = await resolveConsentPage(searchParams(), NOW);
    if (first.kind !== "redirect") throw new Error("expected redirect");
    const next = new URL(first.location, "https://careerotter.io").searchParams.get("next") ?? "";
    const returned = new URL(next, "https://careerotter.io");
    expect(returned.searchParams.get("onboarded")).toBe("1");

    // Onboarding sends the user to `next` as given; the page sees its query.
    const second = await resolveConsentPage(Object.fromEntries(returned.searchParams), NOW);
    expect(second.kind).toBe("render");
    if (second.kind !== "render") return;
    expect(second.view.requestParams).not.toHaveProperty("onboarded");
    expect(second.view.consentPath).not.toContain("onboarded");
    expect(mockNeedsOnboarding).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a repeated marker", ["1", "1"]],
    ["another value", "true"],
  ])("ignores %s and checks onboarding as usual", async (_label, marker) => {
    mockNeedsOnboarding.mockResolvedValue(true);
    const resolution = await resolveConsentPage({ ...searchParams(), onboarded: marker }, NOW);
    expect(resolution.kind).toBe("redirect");
    expect(mockNeedsOnboarding).toHaveBeenCalledWith(USER.id);
  });

  it("shows consent to an existing account", async () => {
    expect((await resolveConsentPage(searchParams(), NOW)).kind).toBe("render");
  });

  it("sends a grant lookup failure to the unavailable card", async () => {
    adminWith({ data: clientRow(), error: null }, { data: null, error: { message: "down" } });
    expect(await resolveConsentPage(searchParams(), NOW)).toEqual({
      kind: "redirect",
      location: "/oauth/error?reason=unavailable",
    });
  });
});

describe("resolveConsentPage: view", () => {
  it("describes the app, destination, user and request", async () => {
    const view = await renderedView();
    expect(view).toMatchObject({
      clientName: "Claude",
      returnDestination: "claude.ai",
      clientUri: "https://claude.ai/about",
      email: USER.email,
      userId: USER.id,
      requestedScopes: ["wins:read", "wins:write", "career:read", "comp:read", "comp:write"],
      hasActiveGrant: false,
      atCap: false,
    });
    expect(view.requestParams).toMatchObject({ client_id: CLIENT_ID, redirect_uri: REDIRECT, state: "xyz" });
    expect(view.consentPath.startsWith("/oauth/consent?")).toBe(true);
  });

  it("hides a client_uri on another host", async () => {
    adminWith({ data: clientRow({ client_uri: "https://claude.example/about" }), error: null });
    expect((await renderedView()).clientUri).toBeNull();
  });

  it("notes that approving replaces an existing grant for this app", async () => {
    adminWith({ data: clientRow(), error: null }, grantRows([CLIENT_ID, OTHER_CLIENT]));
    expect(await renderedView()).toMatchObject({ hasActiveGrant: true, atCap: false });
  });

  it("is at the cap only with the maximum of other apps' active grants", async () => {
    const others = Array.from({ length: AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser }, () => OTHER_CLIENT);
    adminWith({ data: clientRow(), error: null }, grantRows(others));
    expect(await renderedView()).toMatchObject({ hasActiveGrant: false, atCap: true });
  });

  it("counts only unrevoked, unexpired grants", async () => {
    const { or } = adminWith({ data: clientRow(), error: null });
    await renderedView();
    expect(or).toHaveBeenCalledWith(`expires_at.is.null,expires_at.gt.${NOW.toISOString()}`);
  });
});

describe("sameHostClientUri", () => {
  it.each([
    ["the same host", "https://claude.ai/", REDIRECT, "https://claude.ai/"],
    ["the same host with a trailing dot and case", "https://Claude.AI./x", REDIRECT, "https://Claude.AI./x"],
    ["another host", "https://anthropic.com/", REDIRECT, null],
    ["a subdomain", "https://www.claude.ai/", REDIRECT, null],
    ["a loopback redirect", "https://localhost/", "http://localhost:3000/cb", null],
    ["no client_uri", null, REDIRECT, null],
  ])("handles %s", (_label, clientUri, redirect, expected) => {
    expect(sameHostClientUri(clientUri, redirect)).toBe(expected);
  });
});
