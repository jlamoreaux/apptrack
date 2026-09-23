/**
 * @jest-environment node
 */
/**
 * Negative containment (PRD goal 2): an OAuth access token (`co_oat_`) works
 * only at /api/mcp and isn't a Supabase credential.
 * - getAuthenticatedUser (session, then extension bearer JWT) rejects it; a
 *   genuine extension JWT still passes, so the rejection is the token's, not
 *   a broken verifier. jose runs for real here.
 * - the agent-token API (session cookie only) answers 401 to it on every
 *   method and never consults a bearer path or the database
 * - Supabase's getUser with it as the JWT yields no user (GoTrue answers
 *   403 bad_jwt, mocked at fetch)
 */

import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { generatePrefixedSecret } from "@/lib/auth/prefixed-secret";
import { AGENT_OAUTH_PREFIXES } from "@/lib/constants/agent-oauth";
import { SignJWT } from "jose";
import { getAuthenticatedUser } from "@/lib/auth/extension-auth";
import { createAdminClient } from "@/lib/supabase/admin-client";
import {
  DELETE as DELETE_ALL_TOKENS,
  GET as LIST_TOKENS,
  POST as CREATE_TOKEN,
} from "@/app/api/careerotter/agent-tokens/route";
import { DELETE as DELETE_ONE_TOKEN } from "@/app/api/careerotter/agent-tokens/[id]/route";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");

// jose 6 ships only ESM, which Jest's module loader can't evaluate; Node's own
// require can (Node 22), so the real library is loaded through it.
jest.mock("jose", () => mockLoadRealJose());

// process.getBuiltinModule postdates the installed Node typings.
interface NodeBuiltinModules {
  getBuiltinModule(id: "module"): { createRequire(path: string): (id: string) => unknown };
}

function mockLoadRealJose(): unknown {
  const nodeProcess = process as unknown as NodeBuiltinModules;
  return nodeProcess.getBuiltinModule("module").createRequire(__filename)("jose");
}

const mockNoSessionClient = () => {
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: null, error: null }),
  };
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: null }, error: null })) },
    from: () => query,
  };
};

jest.mock("@/lib/supabase/server-client", () => ({
  createClient: jest.fn(async () => mockNoSessionClient()),
}));
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => mockNoSessionClient()),
}));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/redis/client", () => ({ createRateLimiter: jest.fn(() => null) }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const SUPABASE_URL = "https://project.supabase.co";
const SUPABASE_ANON_KEY = "anon-key";
const AGENT_TOKENS_URL = "http://localhost:3000/api/careerotter/agent-tokens";
const TOKEN_ID = "11111111-2222-4333-8444-555555555555";
const EXTENSION_USER = { id: "user-1", email: "u@example.com" };
const JWT_SECRET = "test-extension-secret-with-enough-length";
const UNAUTHORIZED = 401;
const MS_PER_SECOND = 1000;
const EXTENSION_JWT_LIFETIME_SECONDS = 3600;
// getTokenVersion's default when the profile has none.
const EXTENSION_TOKEN_VERSION = 1;
const FORBIDDEN = 403;

// What GoTrue answers for a bearer that isn't a JWT.
const GOTRUE_BAD_JWT = {
  code: FORBIDDEN,
  error_code: "bad_jwt",
  msg: "invalid JWT: unable to parse or verify signature, token is malformed: token contains an invalid number of segments",
};

const ORIGINAL_SECRET = process.env.EXTENSION_JWT_SECRET;

function oauthAccessToken(): string {
  return generatePrefixedSecret(AGENT_OAUTH_PREFIXES.accessToken).raw;
}

// Signed here rather than with signExtensionToken: jose runs in Node's realm,
// where a Date from the test's realm fails its instanceof check, so the
// expiry is given in epoch seconds.
async function signedExtensionJwt(): Promise<string> {
  const expiresAt = Math.floor(Date.now() / MS_PER_SECOND) + EXTENSION_JWT_LIFETIME_SECONDS;
  return new SignJWT({ email: EXTENSION_USER.email, type: "extension", v: EXTENSION_TOKEN_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(EXTENSION_USER.id)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function bearerHeaders(raw: string): Record<string, string> {
  return { authorization: `Bearer ${raw}`, "content-type": "application/json" };
}

beforeAll(() => {
  process.env.EXTENSION_JWT_SECRET = JWT_SECRET;
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.EXTENSION_JWT_SECRET;
  else process.env.EXTENSION_JWT_SECRET = ORIGINAL_SECRET;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("getAuthenticatedUser (extension bearer path)", () => {
  it("rejects a co_oat_ bearer when there is no session", async () => {
    const request = new Request("http://localhost:3000/api/applications", {
      headers: bearerHeaders(oauthAccessToken()),
    });
    expect(await getAuthenticatedUser(request)).toBeNull();
  });

  it("still accepts a genuine extension JWT (control)", async () => {
    const token = await signedExtensionJwt();
    const request = new Request("http://localhost:3000/api/applications", {
      headers: bearerHeaders(token),
    });
    expect(await getAuthenticatedUser(request)).toEqual({ ...EXTENSION_USER, source: "extension" });
  });
});

describe("agent-token API (session cookie only)", () => {
  const raw = oauthAccessToken();

  it.each([
    [
      "POST",
      () =>
        CREATE_TOKEN(
          new NextRequest(AGENT_TOKENS_URL, { method: "POST", headers: bearerHeaders(raw), body: "{}" })
        ),
    ],
    // These two handlers take no request, so they can't read a bearer at all.
    ["GET", () => LIST_TOKENS()],
    ["DELETE all", () => DELETE_ALL_TOKENS()],
    [
      "DELETE one",
      () =>
        DELETE_ONE_TOKEN(
          new NextRequest(`${AGENT_TOKENS_URL}/${TOKEN_ID}`, { method: "DELETE", headers: bearerHeaders(raw) }),
          { params: Promise.resolve({ id: TOKEN_ID }) }
        ),
    ],
  ])("answers %s with 401 when a co_oat_ bearer is all it has", async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(UNAUTHORIZED);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("Supabase getUser", () => {
  it("yields no user for a co_oat_ token used as the JWT", async () => {
    const raw = oauthAccessToken();
    const fetchMock = jest.fn(
      async () =>
        new fetchPrimitives.Response(JSON.stringify(GOTRUE_BAD_JWT), {
          status: FORBIDDEN,
          headers: { "content-type": "application/json" },
        })
    );
    const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: fetchMock },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(raw);

    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe(`${SUPABASE_URL}/auth/v1/user`);
    expect(new fetchPrimitives.Headers(init.headers).get("authorization")).toBe(`Bearer ${raw}`);
  });
});
