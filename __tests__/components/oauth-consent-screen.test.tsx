/**
 * Tests for the OAuth consent screen (components/oauth/consent-screen.tsx and
 * consent-form.tsx):
 * - defaults are wins read and write even when the app asks for all five
 *   scopes; the requested scopes that aren't checked are labelled
 * - client_uri shown only when the view carries it
 * - the replace note; at the cap, the message and manage link with no
 *   Approve button (Deny stays)
 * - Approve posts the canonical params, scopes and expiry as JSON and follows
 *   redirectUrl; Deny posts only the decision
 * - 409 and 5xx show their messages and re-enable the buttons; no scopes
 *   shows an inline error without posting
 * - buttons are at least 44px tall; no axe violations
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConsentScreen } from "@/components/oauth/consent-screen";
import { OAUTH_CONSENT_COPY, OAUTH_CONSENT_MESSAGES } from "@/lib/constants/agent-oauth-ui";
import { navigateTo } from "@/lib/utils/browser-navigation";
import type { AgentOAuthConsentView } from "@/types";

jest.mock("@/lib/actions", () => ({ signOut: jest.fn() }));
jest.mock("@/lib/utils/browser-navigation", () => ({ navigateTo: jest.fn() }));

const REQUEST_PARAMS = {
  response_type: "code",
  client_id: "co_client_AAAAAAAAAAAAAAAAAAAAAA",
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  state: "xyz",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  resource: "https://careerotter.io/api/mcp",
};
const REDIRECT_URL = "https://claude.ai/api/mcp/auth_callback?code=co_code_x&state=xyz";

const mockFetch = global.fetch as jest.Mock;
const mockNavigate = navigateTo as jest.Mock;

function view(overrides: Partial<AgentOAuthConsentView> = {}): AgentOAuthConsentView {
  return {
    clientName: "Claude",
    returnDestination: "claude.ai",
    clientUri: null,
    email: "me@example.com",
    requestedScopes: ["wins:read", "wins:write", "career:read", "comp:read", "comp:write"],
    requestParams: REQUEST_PARAMS,
    consentPath: "/oauth/consent?client_id=x",
    hasActiveGrant: false,
    atCap: false,
    ...overrides,
  };
}

function respondWith(status: number, body: unknown): void {
  mockFetch.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function postedBody(): Record<string, unknown> {
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe("/api/oauth/authorize");
  expect(init.headers).toEqual({ "Content-Type": "application/json" });
  return JSON.parse(init.body);
}

function checkbox(name: string): HTMLElement {
  return screen.getByRole("checkbox", { name });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockNavigate.mockReset();
});

describe("ConsentScreen", () => {
  it("defaults to wins read and write whatever the app requested, labelling the rest", () => {
    render(<ConsentScreen view={view()} />);
    expect(checkbox("Wins: read")).toBeChecked();
    expect(checkbox("Wins: write")).toBeChecked();
    for (const name of ["Career profile: read", "Comp: read", "Comp: write"]) {
      expect(checkbox(name)).not.toBeChecked();
      expect(checkbox(name)).toHaveAccessibleDescription(
        expect.stringContaining(OAUTH_CONSENT_COPY.requestedByApp)
      );
    }
    expect(screen.getAllByText(OAUTH_CONSENT_COPY.requestedByApp)).toHaveLength(3);
  });

  it("drops the requested label once the scope is checked", () => {
    render(<ConsentScreen view={view()} />);
    fireEvent.click(checkbox("Career profile: read"));
    expect(screen.getAllByText(OAUTH_CONSENT_COPY.requestedByApp)).toHaveLength(2);
  });

  it("shows the app, the unverified notice, the destination and the account", () => {
    render(<ConsentScreen view={view()} />);
    expect(screen.getByText(OAUTH_CONSENT_COPY.heading("Claude"))).toBeInTheDocument();
    expect(screen.getByText(OAUTH_CONSENT_COPY.unverified)).toBeInTheDocument();
    expect(screen.getByText("claude.ai").tagName).toBe("STRONG");
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.signOut })).toBeInTheDocument();
    expect(screen.getByText(OAUTH_CONSENT_COPY.noAccount)).toBeInTheDocument();
  });

  it("links the client_uri only when the view carries it", () => {
    const { rerender } = render(<ConsentScreen view={view()} />);
    expect(screen.queryByRole("link", { name: /claude\.ai\/about/ })).not.toBeInTheDocument();
    rerender(<ConsentScreen view={view({ clientUri: "https://claude.ai/about" })} />);
    expect(screen.getByRole("link", { name: "https://claude.ai/about" })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow"
    );
  });

  it("notes that approving replaces the app's current access", () => {
    render(<ConsentScreen view={view({ hasActiveGrant: true })} />);
    expect(screen.getByText(OAUTH_CONSENT_COPY.replacesAccess)).toBeInTheDocument();
  });

  it("offers no Approve button at the cap, only manage and Deny", () => {
    render(<ConsentScreen view={view({ atCap: true })} />);
    expect(screen.queryByRole("button", { name: OAUTH_CONSENT_COPY.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: OAUTH_CONSENT_COPY.manageApps })).toHaveAttribute(
      "href",
      "/dashboard/data"
    );
    expect(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.deny })).toBeInTheDocument();
  });

  it("uses 44px buttons", () => {
    render(<ConsentScreen view={view()} />);
    for (const name of [OAUTH_CONSENT_COPY.approve, OAUTH_CONSENT_COPY.deny]) {
      expect(screen.getByRole("button", { name })).toHaveClass("min-h-11");
    }
  });

  it("has no axe violations", async () => {
    const { container } = render(<ConsentScreen view={view({ clientUri: "https://claude.ai/about" })} />);
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });
});

describe("ConsentForm decisions", () => {
  it("approves with the canonical params, scopes and expiry, then follows the redirect", async () => {
    respondWith(200, { redirectUrl: REDIRECT_URL });
    render(<ConsentScreen view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.approve }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(REDIRECT_URL));
    expect(postedBody()).toEqual({
      params: REQUEST_PARAMS,
      decision: "approve",
      scopes: ["wins:read", "wins:write"],
      expiresInDays: 90,
    });
  });

  it("sends null for an expiry of never", async () => {
    respondWith(200, { redirectUrl: REDIRECT_URL });
    render(<ConsentScreen view={view()} />);
    fireEvent.change(screen.getByLabelText(/expires after/i), { target: { value: "never" } });
    fireEvent.click(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.approve }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ expiresInDays: null });
  });

  it("denies with only the decision", async () => {
    respondWith(200, { redirectUrl: "https://claude.ai/cb?error=access_denied" });
    render(<ConsentScreen view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.deny }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(postedBody()).toEqual({ params: REQUEST_PARAMS, decision: "deny" });
  });

  it.each([
    [409, { error: "cap" }, OAUTH_CONSENT_MESSAGES.atCap],
    [503, { error: "down" }, OAUTH_CONSENT_MESSAGES.retry],
    [400, { error: "Tokens with a comp scope must have an expiry" }, "Tokens with a comp scope must have an expiry"],
    [401, { error: "Unauthorized" }, OAUTH_CONSENT_MESSAGES.unauthorized],
  ])("shows the message for a %i and lets the user try again", async (status, body, message) => {
    respondWith(status, body);
    render(<ConsentScreen view={view()} />);
    const approve = screen.getByRole("button", { name: OAUTH_CONSENT_COPY.approve });
    fireEvent.click(approve);
    expect(await screen.findByText(message)).toHaveAttribute("role", "alert");
    expect(approve).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a network failure", async () => {
    mockFetch.mockRejectedValue(new TypeError("offline"));
    render(<ConsentScreen view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.approve }));
    expect(await screen.findByText(OAUTH_CONSENT_MESSAGES.network)).toBeInTheDocument();
  });

  it("asks for a scope instead of posting none", () => {
    render(<ConsentScreen view={view()} />);
    fireEvent.click(checkbox("Wins: read"));
    fireEvent.click(screen.getByRole("button", { name: OAUTH_CONSENT_COPY.approve }));
    const form = screen.getByRole("form", { name: /approve or deny/i });
    expect(within(form).getByText(OAUTH_CONSENT_MESSAGES.scopesRequired)).toBeInTheDocument();
    expect(checkbox("Wins: read")).toHaveFocus();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
