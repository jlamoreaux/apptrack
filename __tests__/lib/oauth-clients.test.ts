// @jest-environment node
/**
 * Tests for lib/auth/oauth/clients.ts:
 * - validateClientRegistration + registerClient: `none` gets no secret, post
 *   and basic get a `co_cs_` secret stored only as its SHA-256; the client_id
 *   matches the migration's CHECK; redirect URIs stored as the raw strings
 *   sent (case, default port, dot segments) and strings a parser would
 *   rewrite (whitespace, NUL, C1, lone surrogates) rejected; legacy hosts
 *   banned; unused fields like logo_uri never reject; name handling (NFC,
 *   invisible characters stripped, combining-mark runs capped, default when
 *   no letter or digit is left, truncated by grapheme within 100 code
 *   points); grant_types stored and defaulted; response_types and auth method
 *   rules; client_uri kept only when a clean https URL, otherwise dropped;
 *   SDK schema failures mapped to the RFC 7591 codes; database failures
 *   reported as `db`
 * - authenticateClient: every method; a URL-encoded Basic secret; an empty
 *   secret (body or Basic password) counts as none; method mismatch, wrong
 *   secret, unknown client, malformed Basic (including a bare "Basic") and
 *   two methods at once are invalid_client with usedBasic when Basic was
 *   used; a lookup error is `unavailable`
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticateClient,
  registerClient,
  validateClientRegistration,
} from "@/lib/auth/oauth/clients";
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

/** Validate, then store when valid, as the route does. */
async function register(body: unknown) {
  const mock = adminResolving({ data: { created_at: CREATED_AT }, error: null });
  const validation = validateClientRegistration(body);
  const result = validation.ok
    ? await registerClient(mock.admin, validation.registration)
    : { ok: false as const, kind: "rejected" as const, error: validation.error, description: validation.description };
  return { mock, result };
}

function validRegistration(body: unknown) {
  const validation = validateClientRegistration(body);
  if (!validation.ok) throw new Error(`expected a valid registration: ${validation.description}`);
  return validation.registration;
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

    it("strips zero-width, direction-mark, BOM, separator and tag characters", async () => {
      expect(await storedName("Cla\u200Bu\u200Cd\u200De\u2060")).toBe("Claude");
      expect(await storedName("\u200EApp\u200F\u061C\uFEFF")).toBe("App");
      expect(await storedName("A\u2028B\u2029C")).toBe("ABC");
      expect(await storedName("App\u{E0041}\u{E007F}")).toBe("App");
      expect(await storedName("App\u00AD")).toBe("App");
    });

    it("NFC-normalizes the name", async () => {
      expect(await storedName("Cafe\u0301")).toBe("Caf\u00E9");
    });

    it("caps runs of combining marks at three", async () => {
      const zalgo = `q${"\u0300\u0301\u0302\u0303\u0304\u0305".repeat(10)}x`;
      expect(await storedName(zalgo)).toBe("q\u0300\u0301\u0302x");
      expect(await storedName("q\u0300\u0301\u0302")).toBe("q\u0300\u0301\u0302");
    });

    it("falls back to the default when no letter or digit is left", async () => {
      for (const name of [
        "\u200B\u200D\u200E\u200F\u061C\uFEFF\u{E0041}",
        "\u2028\u2029",
        "!!! ---",
        "\u0301\u0302",
        "\u{1F9A6}",
      ]) {
        expect(await storedName(name)).toBe(AGENT_OAUTH_DEFAULT_CLIENT_NAME);
      }
      expect(await storedName("R2")).toBe("R2");
      expect(await storedName("\u{1F9A6} Otter")).toBe("\u{1F9A6} Otter");
    });

    it("truncates to 100 graphemes", async () => {
      expect(await storedName("a".repeat(150))).toBe("a".repeat(AGENT_OAUTH_LIMITS.clientNameMax));
    });

    it("never splits a grapheme, and keeps within 100 code points", async () => {
      const flag = "\u{1F1FA}\u{1F1F8}";
      const max = AGENT_OAUTH_LIMITS.clientNameMax;
      // 100 graphemes but 101 code points: the flag is dropped whole.
      expect(await storedName(`${"a".repeat(max - 1)}${flag}`)).toBe("a".repeat(max - 1));
      // Exactly 100 code points: kept.
      expect(await storedName(`${"a".repeat(max - 2)}${flag}`)).toBe(`${"a".repeat(max - 2)}${flag}`);
      // A letter with a mark that has no precomposed form stays together.
      expect(await storedName(`${"a".repeat(max - 1)}q\u0301`)).toBe("a".repeat(max - 1));
      const thumbs = "\u{1F44D}\u{1F3FD}";
      // "A" plus 49 two-code-point emoji is 100 code points; the 50th won't fit.
      const name = String(await storedName(`A${thumbs.repeat(max)}`));
      expect(name).toBe(`A${thumbs.repeat(max / 2 - 1)}`);
      expect(Array.from(name).length).toBeLessThanOrEqual(max);
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

    it("keeps a URI exactly as sent", async () => {
      expect(await storedUri("https://Claude.AI:443/a/../b")).toBe("https://Claude.AI:443/a/../b");
    });

    it.each([
      ["not a url"],
      ["https://"],
      ["https://claude.ai/ x"],
      [" https://claude.ai"],
      ["https://claude.ai/\u0000"],
      ["https://claude.ai/\uD800"],
      [5],
      [null],
      [{ href: "https://claude.ai" }],
    ])("drops %j without rejecting the registration", async (clientUri) => {
      const { mock, result } = await register({ redirect_uris: [REDIRECT], client_uri: clientUri });
      expect(result.ok).toBe(true);
      expect(insertedRow(mock).client_uri).toBeNull();
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
    const registration = validRegistration({ redirect_uris: [REDIRECT] });
    const failing = adminResolving({ data: null, error: { code: "23514" } });
    expect(await registerClient(failing.admin, registration)).toEqual({ ok: false, kind: "db" });
    const throwing = adminResolving(new Error("network"));
    expect(await registerClient(throwing.admin, registration)).toEqual({ ok: false, kind: "db" });
  });

  describe("redirect_uris are stored as the raw strings sent", () => {
    it.each([
      "https://Claude.AI/api/mcp/auth_callback",
      "https://claude.ai:443/cb",
      "https://claude.ai/a/../cb",
      "https://claude.ai/cb?q=%7E",
      "HTTPS://claude.ai/cb",
      "cursor://Anysphere/Callback",
    ])("stores and returns %s unchanged", async (uri) => {
      const { mock, result } = await register({ redirect_uris: [uri] });
      if (!result.ok) throw new Error("expected success");
      expect(result.client.redirectUris).toEqual([uri]);
      expect(insertedRow(mock).redirect_uris).toEqual([uri]);
    });

    it.each([
      [" https://claude.ai/cb", "leading space"],
      ["https://claude.ai/cb ", "trailing space"],
      ["https://claude.ai/c b", "inner space"],
      ["https://claude.ai/cb\t", "tab"],
      ["https://claude.ai/cb\n", "newline"],
      ["https://claude.ai/\u00A0cb", "no-break space"],
      ["https://claude.ai/\u2028cb", "line separator"],
      ["https://claude.ai/cb\u0000", "NUL"],
      ["https://claude.ai/cb\u007F", "DEL"],
      ["https://claude.ai/cb\u0085", "C1 control"],
      ["https://claude.ai/\uD800cb", "lone high surrogate"],
      ["https://claude.ai/cb\uDC00", "lone low surrogate"],
    ])("rejects a URI with a %j (%s) before parsing", async (uri) => {
      const { mock, result } = await register({ redirect_uris: [uri] });
      expect(result).toMatchObject({ ok: false, kind: "rejected", error: "invalid_redirect_uri" });
      expect(mock.insert).not.toHaveBeenCalled();
    });

    it("accepts a well-formed surrogate pair", async () => {
      const uri = "https://claude.ai/\u{1F9A6}";
      const { result } = await register({ redirect_uris: [uri] });
      expect(result.ok && result.client.redirectUris).toEqual([uri]);
    });

    it.each(["https://apptrack.ing/cb", "https://www.apptrack.ing/cb", "https://APPTRACK.ing./cb"])(
      "rejects a legacy host that redirects to us: %s",
      async (uri) => {
        const { result } = await register({ redirect_uris: [uri] });
        expect(result).toMatchObject({ ok: false, error: "invalid_redirect_uri" });
      }
    );
  });

  it("ignores unused fields, even when they would fail the SDK schema", async () => {
    const { result } = await register({
      redirect_uris: [REDIRECT],
      logo_uri: "not a url",
      tos_uri: 5,
      jwks_uri: "javascript:alert(1)",
      policy_uri: ["x"],
      contacts: "nope",
      scope: 7,
      software_statement: {},
    });
    expect(result.ok).toBe(true);
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

  it.each([
    "Basic !!!",
    "Basic " + Buffer.from("no-separator").toString("base64"),
    "Basic " + Buffer.from("%zz:secret").toString("base64"),
    "Basic",
    "basic   ",
    "BASIC a b",
    "Basic " + Buffer.from(":secret").toString("base64"),
  ])(
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
    for (const authorization of ["Bearer x", "Basicx abc"]) {
      const { result } = await authenticate(clientRow("none", null), new Headers({ authorization }), {
        client_id: CLIENT_ID,
      });
      expect(result.ok).toBe(true);
    }
  });

  it("treats an empty client_secret in the body as absent", async () => {
    const publicClient = await authenticate(clientRow("none", null), new Headers(), {
      client_id: CLIENT_ID,
      client_secret: "",
    });
    expect(publicClient.result.ok).toBe(true);
    const postClient = await authenticate(clientRow("client_secret_post"), new Headers(), {
      client_id: CLIENT_ID,
      client_secret: "",
    });
    expect(postClient.result).toEqual({
      ok: false,
      kind: "invalid_client",
      reason: "method_mismatch",
      usedBasic: false,
    });
  });

  it("treats an empty client_id in the body as missing", async () => {
    const { result } = await authenticate(clientRow("none", null), new Headers(), { client_id: "" });
    expect(result).toMatchObject({ reason: "missing_client_id" });
  });

  it("reads a Basic header with an empty password as the client_id alone", async () => {
    const headers = basicHeader(CLIENT_ID, "");
    const publicClient = await authenticate(clientRow("none", null), headers, {});
    expect(publicClient.result.ok).toBe(true);
    const basicClient = await authenticate(clientRow("client_secret_basic"), headers, {});
    expect(basicClient.result).toEqual({
      ok: false,
      kind: "invalid_client",
      reason: "method_mismatch",
      usedBasic: true,
    });
    const withEmptyBodySecret = await authenticate(clientRow("none", null), headers, { client_secret: "" });
    expect(withEmptyBodySecret.result.ok).toBe(true);
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
