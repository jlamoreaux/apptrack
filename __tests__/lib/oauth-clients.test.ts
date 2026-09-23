// @jest-environment node
/**
 * Tests for lib/auth/oauth/clients.ts:
 * - registerClient: `none` gets no secret, post and basic get a `co_cs_`
 *   secret stored only as its SHA-256; the client_id matches the migration's
 *   CHECK; name handling (default, control and bidi characters stripped, an
 *   emoji truncated at a code-point boundary); grant_types stored and
 *   defaulted; response_types and auth method rules; client_uri kept only
 *   when https; SDK schema failures mapped to the RFC 7591 codes; database
 *   failures reported as `db`
 * - authenticateClient: every method; a URL-encoded Basic secret; method
 *   mismatch, wrong secret, unknown client, malformed Basic and two methods at
 *   once are invalid_client with usedBasic when Basic was used; a lookup
 *   error is `unavailable`
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateClient, registerClient } from "@/lib/auth/oauth/clients";
import { hashSecret, hasValidPrefixedSecretFormat } from "@/lib/auth/prefixed-secret";
import {
  AGENT_OAUTH_CLIENTS_TABLE,
  AGENT_OAUTH_DEFAULT_CLIENT_NAME,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PREFIXES,
} from "@/lib/constants/agent-oauth";
import { SITE_URL } from "@/lib/constants/site-config";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const CREATED_AT = "2026-09-23T12:00:00.000Z";
const CREATED_AT_SECONDS = Date.parse(CREATED_AT) / 1000;
const CLIENT_ID_CHECK = /^co_client_[A-Za-z0-9_-]{22}$/;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface AdminMock {
  admin: SupabaseClient;
  from: jest.Mock;
  insert: jest.Mock;
  eq: jest.Mock;
}

/** A chainable admin client whose terminal call resolves to `result`. */
function adminResolving(result: QueryResult | Error): AdminMock {
  const terminal = jest.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  );
  const query: Record<string, jest.Mock> = {
    insert: jest.fn(() => query),
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: terminal,
    maybeSingle: terminal,
  };
  const from = jest.fn(() => query);
  return { admin: { from } as unknown as SupabaseClient, from, insert: query.insert, eq: query.eq };
}

function insertedRow(mock: AdminMock): Record<string, unknown> {
  return mock.insert.mock.calls[0][0];
}

async function register(body: unknown) {
  const mock = adminResolving({ data: { created_at: CREATED_AT }, error: null });
  const result = await registerClient(mock.admin, body);
  return { mock, result };
}

describe("registerClient", () => {
  it("registers a public client with no secret and the defaults", async () => {
    const { mock, result } = await register({ redirect_uris: [REDIRECT] });
    if (!result.ok) throw new Error("expected success");
    expect(result.client).toEqual({
      clientId: expect.stringMatching(CLIENT_ID_CHECK),
      clientIdIssuedAt: CREATED_AT_SECONDS,
      clientSecret: null,
      redirectUris: [REDIRECT],
      redirectKinds: ["https"],
      grantTypes: ["authorization_code", "refresh_token"],
      tokenEndpointAuthMethod: "none",
      clientName: AGENT_OAUTH_DEFAULT_CLIENT_NAME,
    });
    expect(mock.from).toHaveBeenCalledWith(AGENT_OAUTH_CLIENTS_TABLE);
    expect(insertedRow(mock)).toEqual({
      client_id: result.client.clientId,
      client_secret_hash: null,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      client_name: AGENT_OAUTH_DEFAULT_CLIENT_NAME,
      client_uri: null,
      redirect_uris: [REDIRECT],
    });
  });

  it.each(["client_secret_post", "client_secret_basic"])(
    "issues a co_cs_ secret for %s and stores only its hash",
    async (method) => {
      const { mock, result } = await register({
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: method,
      });
      if (!result.ok) throw new Error("expected success");
      const secret = result.client.clientSecret;
      expect(hasValidPrefixedSecretFormat(secret, AGENT_OAUTH_PREFIXES.clientSecret)).toBe(true);
      const row = insertedRow(mock);
      expect(row.client_secret_hash).toBe(hashSecret(secret ?? ""));
      expect(JSON.stringify(row)).not.toContain(secret);
      expect(row.token_endpoint_auth_method).toBe(method);
    }
  );

  it("stores grant_types in canonical order and accepts authorization_code alone", async () => {
    const both = await register({ redirect_uris: [REDIRECT], grant_types: ["refresh_token", "authorization_code"] });
    expect(both.result.ok && both.result.client.grantTypes).toEqual(["authorization_code", "refresh_token"]);
    const codeOnly = await register({ redirect_uris: [REDIRECT], grant_types: ["authorization_code"] });
    expect(insertedRow(codeOnly.mock).grant_types).toEqual(["authorization_code"]);
  });

  it.each([[["refresh_token"]], [[]], [["authorization_code", "implicit"]], [["client_credentials"]]])(
    "rejects grant_types %j",
    async (grantTypes) => {
      const { mock, result } = await register({ redirect_uris: [REDIRECT], grant_types: grantTypes });
      expect(result).toMatchObject({ ok: false, kind: "rejected", error: "invalid_client_metadata" });
      expect(mock.insert).not.toHaveBeenCalled();
    }
  );

  it("accepts response_types [\"code\"] and rejects anything else", async () => {
    expect((await register({ redirect_uris: [REDIRECT], response_types: ["code"] })).result.ok).toBe(true);
    for (const responseTypes of [["token"], ["code", "token"], []]) {
      const { result } = await register({ redirect_uris: [REDIRECT], response_types: responseTypes });
      expect(result).toMatchObject({ ok: false, error: "invalid_client_metadata" });
    }
  });

  it("rejects an unsupported auth method", async () => {
    const { result } = await register({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "private_key_jwt" });
    expect(result).toMatchObject({ ok: false, error: "invalid_client_metadata" });
  });

  describe("client_name", () => {
    async function storedName(clientName: unknown): Promise<unknown> {
      const { mock } = await register({ redirect_uris: [REDIRECT], client_name: clientName });
      return insertedRow(mock).client_name;
    }

    it("trims and defaults an empty name", async () => {
      expect(await storedName("  Claude  ")).toBe("Claude");
      expect(await storedName("   ")).toBe(AGENT_OAUTH_DEFAULT_CLIENT_NAME);
      expect(await storedName("\u202E\u0007")).toBe(AGENT_OAUTH_DEFAULT_CLIENT_NAME);
    });

    it("strips control and bidi characters", async () => {
      expect(await storedName("Cla\u202Eude\u2066 Code\u2069\n\u0000\u009F")).toBe("Claude Code");
      expect(await storedName("\u202A\u202B\u202C\u202DApp\u2067\u2068")).toBe("App");
    });

    it("truncates by code point, never splitting an emoji", async () => {
      const emoji = "\u{1F9A6}";
      const name = await storedName(`${"a".repeat(AGENT_OAUTH_LIMITS.clientNameMax - 1)}${emoji}${emoji}`);
      expect(name).toBe(`${"a".repeat(AGENT_OAUTH_LIMITS.clientNameMax - 1)}${emoji}`);
      expect(Array.from(String(name))).toHaveLength(AGENT_OAUTH_LIMITS.clientNameMax);
    });
  });

  describe("client_uri", () => {
    async function storedUri(clientUri: string): Promise<unknown> {
      const { mock } = await register({ redirect_uris: [REDIRECT], client_uri: clientUri });
      return insertedRow(mock).client_uri;
    }

    it("keeps an https URI within the limit", async () => {
      expect(await storedUri("https://claude.ai")).toBe("https://claude.ai");
    });

    it("drops http and overlong URIs", async () => {
      expect(await storedUri("http://claude.ai")).toBeNull();
      expect(await storedUri(`https://claude.ai/${"a".repeat(AGENT_OAUTH_LIMITS.clientUriMaxLength)}`)).toBeNull();
    });
  });

  it("maps a redirect_uris schema failure to invalid_redirect_uri", async () => {
    for (const body of [{}, { redirect_uris: "https://claude.ai" }, { redirect_uris: ["javascript:alert(1)"] }]) {
      const { result } = await register(body);
      expect(result).toMatchObject({ ok: false, kind: "rejected", error: "invalid_redirect_uri" });
    }
  });

  it("maps a redirect rule failure to invalid_redirect_uri", async () => {
    const { result } = await register({ redirect_uris: [`${SITE_URL}/callback`] });
    expect(result).toMatchObject({ ok: false, error: "invalid_redirect_uri" });
  });

  it("maps other schema failures to invalid_client_metadata", async () => {
    for (const body of [null, [], "x", { redirect_uris: [REDIRECT], client_name: 5 }]) {
      const { result } = await register(body);
      expect(result).toMatchObject({ ok: false, kind: "rejected", error: "invalid_client_metadata" });
    }
  });

  it("reports an insert error or a throw as db", async () => {
    const failing = adminResolving({ data: null, error: { code: "23514" } });
    expect(await registerClient(failing.admin, { redirect_uris: [REDIRECT] })).toEqual({ ok: false, kind: "db" });
    const throwing = adminResolving(new Error("network"));
    expect(await registerClient(throwing.admin, { redirect_uris: [REDIRECT] })).toEqual({ ok: false, kind: "db" });
  });
});

// ── authenticateClient ──────────────────────────────────────────────────────

const CLIENT_ID = `${AGENT_OAUTH_PREFIXES.clientId}AAAAAAAAAAAAAAAAAAAAAA`;
// Characters that must be form-encoded in Basic credentials.
const SECRET = "co_cs_a+b/c=d:e%f g";

function clientRow(method: string, secret: string | null = SECRET): Record<string, unknown> {
  return {
    client_id: CLIENT_ID,
    client_secret_hash: secret === null ? null : hashSecret(secret),
    token_endpoint_auth_method: method,
    grant_types: ["authorization_code", "refresh_token"],
    client_name: "Claude",
    client_uri: null,
    redirect_uris: [REDIRECT],
    created_at: CREATED_AT,
    first_authorized_at: null,
  };
}

function formEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function basicHeader(clientId: string, secret: string): Headers {
  const encoded = Buffer.from(`${formEncode(clientId)}:${formEncode(secret)}`, "utf8").toString("base64");
  return new Headers({ authorization: `Basic ${encoded}` });
}

async function authenticate(row: Record<string, unknown> | null, headers: Headers, form: Record<string, string>) {
  const mock = adminResolving({ data: row, error: null });
  const result = await authenticateClient(mock.admin, headers, new URLSearchParams(form));
  return { mock, result };
}

describe("authenticateClient", () => {
  it("accepts a public client by client_id alone", async () => {
    const { result, mock } = await authenticate(clientRow("none", null), new Headers(), { client_id: CLIENT_ID });
    expect(result).toEqual({ ok: true, client: expect.objectContaining({ client_id: CLIENT_ID }) });
    expect(result.ok && "client_secret_hash" in result.client).toBe(false);
    expect(mock.eq).toHaveBeenCalledWith("client_id", CLIENT_ID);
  });

  it("accepts client_secret_post", async () => {
    const { result } = await authenticate(clientRow("client_secret_post"), new Headers(), {
      client_id: CLIENT_ID,
      client_secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts client_secret_basic with form-encoded credentials", async () => {
    const { result } = await authenticate(clientRow("client_secret_basic"), basicHeader(CLIENT_ID, SECRET), {});
    expect(result.ok).toBe(true);
  });

  it("accepts a matching client_id in the body alongside Basic", async () => {
    const { result } = await authenticate(clientRow("client_secret_basic"), basicHeader(CLIENT_ID, SECRET), {
      client_id: CLIENT_ID,
    });
    expect(result.ok).toBe(true);
  });

  it("form-decodes Basic credentials, so an unencoded + reads as a space", async () => {
    const plusSecret = "co_cs_a+b";
    const raw = Buffer.from(`${CLIENT_ID}:${plusSecret}`).toString("base64");
    const headers = new Headers({ authorization: `Basic ${raw}` });
    const { result } = await authenticate(clientRow("client_secret_basic", plusSecret), headers, {});
    expect(result).toEqual({ ok: false, kind: "invalid_client", reason: "wrong_secret", usedBasic: true });
  });

  it.each([
    ["client_secret_basic", "post"],
    ["client_secret_post", "basic"],
    ["none", "post"],
    ["client_secret_post", "none"],
  ])("rejects a %s client presenting %s", async (registered, used) => {
    const headers = used === "basic" ? basicHeader(CLIENT_ID, SECRET) : new Headers();
    const form: Record<string, string> =
      used === "post" ? { client_id: CLIENT_ID, client_secret: SECRET } : used === "none" ? { client_id: CLIENT_ID } : {};
    const { result } = await authenticate(clientRow(registered), headers, form);
    expect(result).toEqual({
      ok: false,
      kind: "invalid_client",
      reason: "method_mismatch",
      usedBasic: used === "basic",
    });
  });

  it("rejects a wrong secret by either method", async () => {
    const post = await authenticate(clientRow("client_secret_post"), new Headers(), {
      client_id: CLIENT_ID,
      client_secret: `${SECRET}x`,
    });
    expect(post.result).toEqual({ ok: false, kind: "invalid_client", reason: "wrong_secret", usedBasic: false });
    const basic = await authenticate(clientRow("client_secret_basic"), basicHeader(CLIENT_ID, "nope"), {});
    expect(basic.result).toEqual({ ok: false, kind: "invalid_client", reason: "wrong_secret", usedBasic: true });
  });

  it("rejects an unknown client, and a malformed id without a lookup", async () => {
    const unknown = await authenticate(null, basicHeader(CLIENT_ID, SECRET), {});
    expect(unknown.result).toEqual({ ok: false, kind: "invalid_client", reason: "unknown_client", usedBasic: true });
    const malformed = await authenticate(clientRow("none"), new Headers(), { client_id: "not-a-client" });
    expect(malformed.result).toMatchObject({ reason: "unknown_client", usedBasic: false });
    expect(malformed.mock.from).not.toHaveBeenCalled();
  });

  it("rejects a missing client_id", async () => {
    const { result } = await authenticate(clientRow("none"), new Headers(), {});
    expect(result).toEqual({ ok: false, kind: "invalid_client", reason: "missing_client_id", usedBasic: false });
  });

  it.each(["Basic !!!", "Basic " + Buffer.from("no-separator").toString("base64"), "Basic " + Buffer.from("%zz:secret").toString("base64")])(
    "rejects malformed Basic credentials: %s",
    async (authorization) => {
      const { result } = await authenticate(clientRow("client_secret_basic"), new Headers({ authorization }), {});
      expect(result).toEqual({ ok: false, kind: "invalid_client", reason: "malformed_basic", usedBasic: true });
    }
  );

  it("rejects two methods at once", async () => {
    const withSecret = await authenticate(clientRow("client_secret_basic"), basicHeader(CLIENT_ID, SECRET), {
      client_secret: SECRET,
    });
    expect(withSecret.result).toMatchObject({ reason: "multiple_methods", usedBasic: true });
    const otherId = await authenticate(clientRow("client_secret_basic"), basicHeader(CLIENT_ID, SECRET), {
      client_id: `${AGENT_OAUTH_PREFIXES.clientId}BBBBBBBBBBBBBBBBBBBBBB`,
    });
    expect(otherId.result).toMatchObject({ reason: "multiple_methods", usedBasic: true });
  });

  it("ignores a non-Basic Authorization header", async () => {
    const { result } = await authenticate(clientRow("none", null), new Headers({ authorization: "Bearer x" }), {
      client_id: CLIENT_ID,
    });
    expect(result.ok).toBe(true);
  });

  it("reports a lookup error, a throw or a malformed row as unavailable", async () => {
    const form = new URLSearchParams({ client_id: CLIENT_ID });
    const errored = adminResolving({ data: null, error: { message: "down" } });
    expect(await authenticateClient(errored.admin, new Headers(), form)).toEqual({ ok: false, kind: "unavailable" });
    const thrown = adminResolving(new Error("network"));
    expect(await authenticateClient(thrown.admin, new Headers(), form)).toEqual({ ok: false, kind: "unavailable" });
    const malformed = adminResolving({ data: { ...clientRow("none", null), grant_types: ["bogus"] }, error: null });
    expect(await authenticateClient(malformed.admin, new Headers(), form)).toEqual({ ok: false, kind: "unavailable" });
  });
});
