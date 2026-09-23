/**
 * @jest-environment node
 */
/**
 * middleware.ts sends a signed-in user on /login or /signup to a valid
 * redirectTo (e.g. an app connection's consent page), and to /dashboard when
 * there is none or it isn't an internal path. Signed-out users see the page.
 */

import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PASS_THROUGH = { passThrough: true };

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    constructor(_body: unknown, init?: { status?: number }) {
      this.status = init?.status ?? 200;
    }
    static next = jest.fn(() => PASS_THROUGH);
    static redirect = jest.fn((url: URL) => ({ redirectedTo: url.toString() }));
    static rewrite = jest.fn();
  }
  return { NextResponse: MockNextResponse };
});
jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("@/lib/rebrand-redirect", () => ({ resolveLegacyRedirect: jest.fn(() => null) }));

const { middleware } = require("@/middleware");

const mockCreateServerClient = createServerClient as jest.Mock;
const ORIGIN = "https://careerotter.io";
const CONSENT_PATH = "/oauth/consent?client_id=co_client_x&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb";

function signedIn(user: { id: string } | null): void {
  mockCreateServerClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

function pageRequest(pathAndQuery: string): NextRequest {
  const url = new URL(pathAndQuery, ORIGIN);
  const request = {
    method: "GET",
    url: url.toString(),
    nextUrl: url,
    headers: new Headers({ host: "careerotter.io", accept: "text/html" }),
    cookies: { getAll: () => [], set: jest.fn() },
  };
  return request as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signed-in users on the auth pages", () => {
  it.each(["/login", "/signup"])("%s goes to a valid redirectTo", async (page) => {
    signedIn({ id: "u1" });
    const response = await middleware(pageRequest(`${page}?redirectTo=${encodeURIComponent(CONSENT_PATH)}`));
    expect(response).toEqual({ redirectedTo: `${ORIGIN}${CONSENT_PATH}` });
  });

  it.each([
    ["no redirectTo", "/login"],
    ["an absolute redirectTo", "/login?redirectTo=https%3A%2F%2Fevil.example%2F"],
    ["a protocol-relative redirectTo", "/login?redirectTo=%2F%2Fevil.example%2F"],
  ])("goes to the dashboard with %s", async (_label, path) => {
    signedIn({ id: "u1" });
    const response = await middleware(pageRequest(path));
    expect(response).toEqual({ redirectedTo: `${ORIGIN}/dashboard` });
  });

  it("lets a signed-out user see the login page", async () => {
    signedIn(null);
    const response = await middleware(pageRequest(`/login?redirectTo=${encodeURIComponent(CONSENT_PATH)}`));
    expect(response).toBe(PASS_THROUGH);
  });
});
