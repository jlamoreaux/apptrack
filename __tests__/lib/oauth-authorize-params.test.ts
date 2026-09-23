// @jest-environment node
/**
 * Tests for lib/auth/oauth/authorize-params.ts:
 * - fatal: unknown or malformed client_id, a missing, unregistered or
 *   repeated redirect_uri (never redirected)
 * - unavailable when the client lookup fails
 * - redirect errors: wrong or missing response_type, plain or missing PKCE,
 *   overlong (in UTF-8 bytes) or repeated state (not echoed), overlong scope,
 *   foreign or malformed resource; each carries the presented redirect and
 *   valid state
 * - ok: a loopback URI on another port (redirect to the presented URI, store
 *   the registered one), an absent resource becomes the canonical one, a
 *   resource with a trailing slash normalizes, openid and offline_access are
 *   ignored
 * - the canonical query rebuilds only validated values, round-trips through
 *   the validator, and passes isValidInternalPath even when the original
 *   parameters were unencoded
 * - URL budget: with maximum-length inputs, the login href, the Google
 *   sign-in chain (login href inside the callback's next inside Supabase's
 *   redirect_to) and the sign-up emailRedirectTo inside Supabase's email link
 *   all stay under 8 KB; a request whose nesting would exceed it is refused
 *   as invalid_request ("request too large")
 * - redirect URLs keep the redirect's own query, never add a fragment, and
 *   always carry iss (and state when present)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accessDeniedRedirectUrl,
  authorizationCodeRedirectUrl,
  authorizationErrorRedirectUrl,
  canonicalAuthorizeQuery,
  consentPathFitsBudget,
  consentPathFor,
  nestedConsentPathLength,
  oauthErrorPath,
  searchParamsFromRecord,
  validateAuthorizeRequest,
} from "@/lib/auth/oauth/authorize-params";
import {
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_ISSUER,
  AGENT_OAUTH_LIMITS,
  CANONICAL_MCP_RESOURCE,
} from "@/lib/constants/agent-oauth";
import { SITE_URL } from "@/lib/constants/site-config";
import { authCallbackUrl, loginHref } from "@/lib/utils/auth-redirect";
import { isValidInternalPath } from "@/lib/utils/internal-path";
import type { AgentOAuthAuthorizeParams, AgentOAuthAuthorizeValidation } from "@/types";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const CLIENT_ID = "co_client_AAAAAAAAAAAAAAAAAAAAAA";
const HTTPS_REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const LOOPBACK_REDIRECT = "http://127.0.0.1:33418/callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const STATE = "af0ifjsldkj";

// Supabase's own URLs around redirect_to: Google sign-in and the sign-up
// confirmation email's link (a 20-character project ref, PKCE and token
// parameters at their real lengths).
const SUPABASE_AUTHORIZE =
  "https://abcdefghijklmnopqrst.supabase.co/auth/v1/authorize?provider=google&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=s256&redirect_to=";
const SUPABASE_VERIFY = `https://abcdefghijklmnopqrst.supabase.co/auth/v1/verify?token=pkce_${"a".repeat(56)}&type=signup&redirect_to=`;
// The documented budget for any URL the consent path is nested in.
const URL_BUDGET = 8 * 1024;

function clientRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    client_id: CLIENT_ID,
    client_secret_hash: null,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    client_name: "Claude",
    client_uri: null,
    redirect_uris: [HTTPS_REDIRECT, "http://127.0.0.1/callback"],
    created_at: "2026-09-23T12:00:00.000Z",
    first_authorized_at: null,
    ...overrides,
  };
}

function adminReturning(result: { data: unknown; error: unknown }): {
  admin: SupabaseClient;
  from: jest.Mock;
} {
  const query: Record<string, jest.Mock> = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.maybeSingle = jest.fn(() => Promise.resolve(result));
  const from = jest.fn(() => query);
  return { admin: { from } as unknown as SupabaseClient, from };
}

function validRequest(overrides: Record<string, string | string[] | undefined> = {}): URLSearchParams {
  return searchParamsFromRecord({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: HTTPS_REDIRECT,
    state: STATE,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    ...overrides,
  });
}

async function validate(
  params: URLSearchParams,
  row: Record<string, unknown> | null = clientRow()
): Promise<AgentOAuthAuthorizeValidation> {
  return validateAuthorizeRequest(adminReturning({ data: row, error: null }).admin, params);
}

async function okParams(params: URLSearchParams): Promise<AgentOAuthAuthorizeParams> {
  const result = await validate(params);
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return result.params;
}

/** A valid request's params for a client that registered `redirectUri`. */
async function paramsRegisteredFor(
  redirectUri: string,
  overrides: Record<string, string | undefined> = {}
): Promise<AgentOAuthAuthorizeParams> {
  const result = await validateAuthorizeRequest(
    adminReturning({ data: clientRow({ redirect_uris: [redirectUri] }), error: null }).admin,
    validRequest({ redirect_uri: redirectUri, ...overrides })
  );
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return result.params;
}

describe("validateAuthorizeRequest: fatal", () => {
  it("rejects an unknown client without redirecting", async () => {
    expect(await validate(validRequest(), null)).toEqual({ kind: "fatal", reason: "unknown_client" });
  });

  it("rejects a malformed client_id without a database query", async () => {
    const { admin, from } = adminReturning({ data: clientRow(), error: null });
    const result = await validateAuthorizeRequest(admin, validRequest({ client_id: "claude" }));
    expect(result).toEqual({ kind: "fatal", reason: "unknown_client" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["unregistered", "https://evil.example/callback"],
    ["differing only in case", "https://Claude.ai/api/mcp/auth_callback"],
    ["repeated", [HTTPS_REDIRECT, HTTPS_REDIRECT]],
  ])("rejects a %s redirect_uri", async (_label, redirectUri) => {
    expect(await validate(validRequest({ redirect_uri: redirectUri }))).toEqual({
      kind: "fatal",
      reason: "invalid_redirect_uri",
    });
  });

  it("reports a lookup failure as unavailable", async () => {
    const { admin } = adminReturning({ data: null, error: { message: "down" } });
    expect(await validateAuthorizeRequest(admin, validRequest())).toEqual({ kind: "unavailable" });
  });

  it("looks the client up by id", async () => {
    const { admin, from } = adminReturning({ data: clientRow(), error: null });
    await validateAuthorizeRequest(admin, validRequest());
    expect(from).toHaveBeenCalledWith(AGENT_OAUTH_CLIENTS_TABLE);
  });
});

describe("validateAuthorizeRequest: redirect errors", () => {
  it.each([
    ["a token response_type", { response_type: "token" }, "unsupported_response_type"],
    ["a missing response_type", { response_type: undefined }, "unsupported_response_type"],
    ["the plain PKCE method", { code_challenge_method: "plain" }, "invalid_request"],
    ["a missing PKCE method", { code_challenge_method: undefined }, "invalid_request"],
    ["a missing challenge", { code_challenge: undefined }, "invalid_request"],
    ["a short challenge", { code_challenge: CHALLENGE.slice(1) }, "invalid_request"],
    ["a challenge outside base64url", { code_challenge: `${CHALLENGE.slice(1)}+` }, "invalid_request"],
    ["an overlong scope", { scope: "a".repeat(AGENT_OAUTH_LIMITS.scopeParamMaxLength + 1) }, "invalid_request"],
    ["a foreign resource", { resource: "https://evil.example/api/mcp" }, "invalid_target"],
    ["another path on our origin", { resource: `${SITE_URL}/api/other` }, "invalid_target"],
    ["a resource with a fragment", { resource: `${CANONICAL_MCP_RESOURCE}#x` }, "invalid_target"],
  ])("sends %s back to the client", async (_label, overrides, error) => {
    const result = await validate(validRequest(overrides));
    expect(result).toMatchObject({
      kind: "redirect_error",
      redirectUri: HTTPS_REDIRECT,
      state: STATE,
      error,
    });
  });

  it("refuses an overlong state without echoing it", async () => {
    const result = await validate(
      validRequest({ state: "s".repeat(AGENT_OAUTH_LIMITS.stateMaxBytes + 1) })
    );
    expect(result).toMatchObject({ kind: "redirect_error", error: "invalid_request", state: null });
  });

  it("refuses a repeated state without echoing it", async () => {
    const result = await validate(validRequest({ state: ["a", "b"] }));
    expect(result).toMatchObject({ kind: "redirect_error", error: "invalid_request", state: null });
  });

  it("accepts a state at the limit", async () => {
    const state = "s".repeat(AGENT_OAUTH_LIMITS.stateMaxBytes);
    expect((await okParams(validRequest({ state }))).state).toBe(state);
  });

  it("measures state in UTF-8 bytes, not UTF-16 code units", async () => {
    const twoByte = "\u00E9";
    const atLimit = twoByte.repeat(AGENT_OAUTH_LIMITS.stateMaxBytes / 2);
    expect((await okParams(validRequest({ state: atLimit }))).state).toBe(atLimit);

    const threeByte = "\u20AC".repeat(Math.floor(AGENT_OAUTH_LIMITS.stateMaxBytes / 3) + 1);
    expect(threeByte.length).toBeLessThan(AGENT_OAUTH_LIMITS.stateMaxBytes);
    const result = await validate(validRequest({ state: threeByte }));
    expect(result).toMatchObject({ kind: "redirect_error", error: "invalid_request", state: null });
  });
});

describe("validateAuthorizeRequest: ok", () => {
  it("accepts a loopback redirect on another port and redirects to the presented one", async () => {
    const params = await okParams(validRequest({ redirect_uri: LOOPBACK_REDIRECT }));
    expect(params.redirectUri).toBe(LOOPBACK_REDIRECT);
    expect(params.registeredRedirectUri).toBe("http://127.0.0.1/callback");
  });

  it("uses the canonical resource when none is given", async () => {
    expect((await okParams(validRequest())).resource).toBe(CANONICAL_MCP_RESOURCE);
  });

  it("normalizes a presented resource", async () => {
    const params = await okParams(validRequest({ resource: `${CANONICAL_MCP_RESOURCE}/` }));
    expect(params.resource).toBe(CANONICAL_MCP_RESOURCE);
  });

  it("ignores unknown scopes and reports the known ones in canonical order", async () => {
    const result = await validate(
      validRequest({ scope: "openid offline_access comp:read wins:write profile wins:write" })
    );
    expect(result).toMatchObject({ kind: "ok", requestedScopes: ["wins:write", "comp:read"] });
  });

  it("treats an empty state as absent", async () => {
    expect((await okParams(validRequest({ state: "" }))).state).toBeNull();
  });

  it("returns the client record", async () => {
    const result = await validate(validRequest());
    expect(result).toMatchObject({ kind: "ok", client: { client_id: CLIENT_ID, client_name: "Claude" } });
  });
});

describe("canonical query", () => {
  it("round-trips through the validator", async () => {
    const params = await okParams(validRequest({ scope: "wins:read comp:read", resource: CANONICAL_MCP_RESOURCE }));
    expect(await okParams(canonicalAuthorizeQuery(params))).toEqual(params);
  });

  it("carries only validated parameters", async () => {
    const params = await okParams(validRequest({ prompt: "none", extra: "x" }));
    const query = canonicalAuthorizeQuery(params);
    expect(query.has("prompt")).toBe(false);
    expect(query.has("extra")).toBe(false);
    expect(query.get("resource")).toBe(CANONICAL_MCP_RESOURCE);
  });

  it("builds the consent path", async () => {
    const params = await okParams(validRequest());
    expect(consentPathFor(params)).toBe(`/oauth/consent?${canonicalAuthorizeQuery(params)}`);
  });

  it("passes isValidInternalPath through the login href with unencoded input", async () => {
    const longRedirect = `${HTTPS_REDIRECT}?next=https://claude.ai/${"p".repeat(300)}`;
    const params = await paramsRegisteredFor(longRedirect, {
      state: "s".repeat(AGENT_OAUTH_LIMITS.stateMaxBytes),
      scope: "wins:read wins:write career:read comp:read comp:write openid offline_access",
    });

    const consentPath = consentPathFor(params);
    const redirectTo = new URL(loginHref(consentPath), SITE_URL).searchParams.get("redirectTo");
    expect(redirectTo).toBe(consentPath);
    expect(isValidInternalPath(redirectTo)).toBe(true);
  });
});

describe("consent URL budget", () => {
  /** Every URL a consent path is carried in, as the app and Supabase build them. */
  function nestedUrls(consentPath: string): Record<string, string> {
    const login = loginHref(consentPath);
    // Google sign-in from the login page, taken one level deeper than it
    // really goes (the login href itself inside the callback's next).
    const googleCallback = authCallbackUrl(SITE_URL, login);
    // The sign-up confirmation email: signUpWithPassword's emailRedirectTo.
    const emailRedirectTo = authCallbackUrl(SITE_URL, consentPath);
    return {
      consentPath,
      login,
      googleCallback,
      supabaseAuthorize: `${SUPABASE_AUTHORIZE}${encodeURIComponent(googleCallback)}`,
      emailRedirectTo,
      supabaseVerify: `${SUPABASE_VERIFY}${encodeURIComponent(emailRedirectTo)}`,
    };
  }

  // 512 characters, the registration maximum.
  const MAX_REDIRECT = `https://app.example/${"p".repeat(AGENT_OAUTH_LIMITS.redirectUriMaxLength - 20)}`;
  const MAX_SCOPE = "wins:read wins:write career:read comp:read comp:write "
    .repeat(6)
    .slice(0, AGENT_OAUTH_LIMITS.scopeParamMaxLength)
    .trimEnd();

  it("keeps every nested URL under 8 KB with maximum-length inputs", async () => {
    expect(MAX_REDIRECT).toHaveLength(AGENT_OAUTH_LIMITS.redirectUriMaxLength);
    const params = await paramsRegisteredFor(MAX_REDIRECT, {
      state: "A".repeat(AGENT_OAUTH_LIMITS.stateMaxBytes),
      scope: MAX_SCOPE,
      resource: CANONICAL_MCP_RESOURCE,
    });
    const urls = nestedUrls(consentPathFor(params));
    expect(urls.consentPath.length).toBeLessThanOrEqual(AGENT_OAUTH_LIMITS.consentPathMaxLength);
    for (const [label, url] of Object.entries(urls)) {
      // The label names the offending URL if this fails.
      expect([label, url.length < URL_BUDGET]).toEqual([label, true]);
    }
  });

  it("keeps every nested URL under 8 KB with a maximum multi-byte state", async () => {
    const params = await paramsRegisteredFor(HTTPS_REDIRECT, {
      state: "\u00E9".repeat(AGENT_OAUTH_LIMITS.stateMaxBytes / 2),
      scope: MAX_SCOPE,
    });
    for (const url of Object.values(nestedUrls(consentPathFor(params)))) {
      expect(url.length).toBeLessThan(URL_BUDGET);
    }
  });

  it("refuses a request whose nesting would exceed the budget as request too large", async () => {
    const reservedHeavy = `https://app.example/${"/".repeat(AGENT_OAUTH_LIMITS.redirectUriMaxLength - 20)}`;
    const result = await validateAuthorizeRequest(
      adminReturning({ data: clientRow({ redirect_uris: [reservedHeavy] }), error: null }).admin,
      validRequest({
        redirect_uri: reservedHeavy,
        state: "\u00E9".repeat(AGENT_OAUTH_LIMITS.stateMaxBytes / 2),
        scope: " ".repeat(AGENT_OAUTH_LIMITS.scopeParamMaxLength),
      })
    );
    expect(result).toMatchObject({
      kind: "redirect_error",
      redirectUri: reservedHeavy,
      error: "invalid_request",
      description: "request too large",
    });
  });

  it("accepts anything that fits, and every accepted path's Supabase URLs fit too", () => {
    const small = "/oauth/consent?client_id=a";
    expect(consentPathFitsBudget(small)).toBe(true);
    const tooLong = `/oauth/consent?state=${"a".repeat(AGENT_OAUTH_LIMITS.consentPathMaxLength)}`;
    expect(consentPathFitsBudget(tooLong)).toBe(false);
    const nestsTooDeep = `/oauth/consent?state=${"%C3%A9".repeat(700)}`;
    expect(nestsTooDeep.length).toBeLessThan(AGENT_OAUTH_LIMITS.consentPathMaxLength);
    expect(nestedConsentPathLength(nestsTooDeep)).toBeGreaterThan(AGENT_OAUTH_LIMITS.nestedRedirectMaxLength);
    expect(consentPathFitsBudget(nestsTooDeep)).toBe(false);
  });
});

describe("redirect URLs", () => {
  const paramsFor = (redirectUri: string) => paramsRegisteredFor(redirectUri);

  it("appends the code, state and iss, keeping the redirect's own query", async () => {
    const url = new URL(authorizationCodeRedirectUrl(await paramsFor("https://app.example/cb?tenant=a"), "co_code_x"));
    expect(url.searchParams.get("tenant")).toBe("a");
    expect(url.searchParams.get("code")).toBe("co_code_x");
    expect(url.searchParams.get("state")).toBe(STATE);
    expect(url.searchParams.get("iss")).toBe(AGENT_OAUTH_ISSUER);
    expect(url.hash).toBe("");
  });

  it("omits state when the request had none", async () => {
    const url = new URL(authorizationCodeRedirectUrl(await paramsRegisteredFor(HTTPS_REDIRECT, { state: undefined }), "c"));
    expect(url.searchParams.has("state")).toBe(false);
    expect(url.searchParams.get("iss")).toBe(AGENT_OAUTH_ISSUER);
  });

  it("works for a private-use scheme", async () => {
    const redirect = authorizationCodeRedirectUrl(await paramsFor("cursor://anysphere.cursor-mcp/oauth/callback"), "c");
    expect(redirect.startsWith("cursor://anysphere.cursor-mcp/oauth/callback?code=c&state=")).toBe(true);
    expect(redirect).not.toContain("#");
  });

  it("builds access_denied for a denial", async () => {
    const url = new URL(accessDeniedRedirectUrl(await paramsFor(HTTPS_REDIRECT)));
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("state")).toBe(STATE);
    expect(url.searchParams.get("iss")).toBe(AGENT_OAUTH_ISSUER);
  });

  it("builds a redirect error with its description", () => {
    const url = new URL(
      authorizationErrorRedirectUrl({
        redirectUri: `${HTTPS_REDIRECT}?`,
        state: null,
        error: "invalid_target",
        description: "bad resource",
      })
    );
    expect(url.search).toBe(`?error=invalid_target&error_description=bad+resource&iss=${encodeURIComponent(AGENT_OAUTH_ISSUER)}`);
  });

  it("names the unavailable reason on the error page only when needed", () => {
    expect(oauthErrorPath("invalid")).toBe("/oauth/error");
    expect(oauthErrorPath("unavailable")).toBe("/oauth/error?reason=unavailable");
  });
});
