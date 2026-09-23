/**
 * Connected apps and the "Sign in with your browser" setup on the data page:
 * - the page: with OAuth disabled neither is shown and the grants API isn't
 *   called; with it enabled the setup comes first
 * - the list: name, where the app sends the user back (loopback text),
 *   scopes, dates and status; Revoke only for active apps, with the name
 *   isolated for bidi
 * - revoking asks for confirmation first, then re-reads the list; a failure
 *   is shown inline and the list re-read
 * - Revoke all agent access: shown while any token or app is active; reloads
 *   both lists, even after a partial failure
 * - a single "session expired" alert when both lists get a 401
 * - the setup snippets carry the MCP URL and no token or header
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import DataPage from "@/app/(app)/dashboard/data/page";
import { AgentOAuthSetup } from "@/components/careerotter/agent-oauth-setup";
import { ConnectedAgents } from "@/components/careerotter/connected-agents";
import { getUser } from "@/lib/supabase/server";
import { AGENT_TOKEN_PREFIX } from "@/lib/constants/agent-access";
import { isolateBidi } from "@/lib/constants/agent-access-ui";
import { CANONICAL_MCP_RESOURCE } from "@/lib/constants/agent-oauth";
import type { AgentOAuthGrantSummary, AgentTokenRecord } from "@/types";

jest.mock("@/lib/supabase/server", () => ({ getUser: jest.fn() }));
jest.mock("@/components/navigation-server", () => ({ NavigationServer: () => null }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const SITE = "https://careerotter.test";
const MCP_URL = "https://careerotter.io/api/mcp";
const TOKENS_URL = "/api/careerotter/agent-tokens";
const GRANTS_URL = "/api/careerotter/agent-grants";

const HTTP = { ok: 200, multipleChoices: 300, unauthorized: 401, notFound: 404, serverError: 500 } as const;
const ENV_KEYS = ["CAREEROTTER_ENABLED", "CAREEROTTER_MCP_OAUTH_ENABLED", "VERCEL_ENV"] as const;
const savedEnv = ENV_KEYS.map((key) => [key, process.env[key]] as const);

const LOOPBACK_APP: AgentOAuthGrantSummary = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  clientName: "Claude Code",
  redirectDisplay: "an app on this computer (localhost:33418)",
  scopes: ["wins:read", "wins:write"],
  createdAt: "2026-09-01T12:00:00Z",
  lastUsedAt: "2026-09-20T12:00:00Z",
  expiresAt: null,
  status: "active",
};

const REVOKED_APP: AgentOAuthGrantSummary = {
  ...LOOPBACK_APP,
  id: "bbbbbbbb-2222-4222-8222-222222222222",
  clientName: "Old connector",
  redirectDisplay: "claude.ai",
  scopes: ["career:read"],
  expiresAt: "2026-12-01T12:00:00Z",
  status: "revoked",
};

const ACTIVE_TOKEN: AgentTokenRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Nightly script",
  token_prefix: "co_pat_AbCdEfG",
  scopes: ["wins:read"],
  created_at: "2026-09-01T12:00:00Z",
  last_used_at: null,
  expires_at: "2026-11-30T12:00:00Z",
  revoked_at: null,
  status: "active",
};

// jest.setup.js replaces Response with a stub that has no `ok`; add it so the
// client sees what a browser would.
class TestResponse extends Response {
  constructor(body: unknown, status: number) {
    super(JSON.stringify(body), { status });
    Object.defineProperty(this, "ok", {
      value: status >= HTTP.ok && status < HTTP.multipleChoices,
    });
  }
}

type Route = `${"GET" | "DELETE"} ${string}`;

let fetchMock: jest.SpiedFunction<typeof fetch>;
interface Scripted {
  body: unknown;
  status: number;
}

// Scripted responses per method and URL, consumed in order; once a route's
// queue is empty, its last response repeats.
let routes: Map<Route, Scripted[]>;
let lastServed: Map<Route, Scripted>;

function script(route: Route, body: unknown, status: number = HTTP.ok): void {
  const queue = routes.get(route) ?? [];
  queue.push({ body, status });
  routes.set(route, queue);
}

function calls(route: Route): number {
  return fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === route)
    .length;
}

function renderAgents(oauthEnabled: boolean): ReturnType<typeof render> {
  return render(<ConnectedAgents appUrl={SITE} oauthEnabled={oauthEnabled} />);
}

async function renderPage(oauthEnabled: boolean): Promise<ReturnType<typeof render>> {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.VERCEL_ENV = "production";
  if (oauthEnabled) process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  else delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
  (getUser as jest.Mock).mockResolvedValue({ id: "user-1" });
  const view = render(await DataPage());
  await screen.findByRole("form", { name: /create an agent token/i });
  return view;
}

async function renderWithApps(
  grants: AgentOAuthGrantSummary[],
  tokens: AgentTokenRecord[] = [ACTIVE_TOKEN]
): Promise<ReturnType<typeof render>> {
  script(`GET ${GRANTS_URL}`, { enabled: true, grants });
  script(`GET ${TOKENS_URL}`, { tokens });
  const view = renderAgents(true);
  await screen.findByRole("form", { name: /create an agent token/i });
  await waitFor(() =>
    expect(screen.queryByText(/loading connected apps/i)).not.toBeInTheDocument()
  );
  return view;
}

function revokeName(clientName: string): string {
  return `Revoke ${isolateBidi(clientName)}`;
}

function appsList(): HTMLElement {
  return screen.getByRole("list", { name: "Connected apps" });
}

async function confirmInDialog(buttonName: string): Promise<void> {
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: buttonName }));
}

beforeEach(() => {
  routes = new Map();
  lastServed = new Map();
  fetchMock = jest.spyOn(global, "fetch");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const route: Route = `${init?.method === "DELETE" ? "DELETE" : "GET"} ${String(input)}`;
    const next = routes.get(route)?.shift() ?? lastServed.get(route);
    // Any request a test did not script fails like a dropped connection.
    if (!next) throw new Error(`unexpected fetch: ${route}`);
    lastServed.set(route, next);
    return new TestResponse(next.body, next.status);
  });
});

afterEach(() => {
  fetchMock.mockRestore();
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("the data page", () => {
  it("with OAuth disabled shows neither the sign-in option nor the apps list, and never calls the grants API", async () => {
    script(`GET ${TOKENS_URL}`, { tokens: [ACTIVE_TOKEN] });
    await renderPage(false);
    expect(screen.queryByRole("heading", { name: "Sign in with your browser" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connected apps" })).not.toBeInTheDocument();
    expect(calls(`GET ${GRANTS_URL}`)).toBe(0);
  });

  it("with OAuth enabled puts the sign-in option before the apps list and the token form", async () => {
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [] });
    script(`GET ${TOKENS_URL}`, { tokens: [] });
    await renderPage(true);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings.slice(0, 3)).toEqual(["Sign in with your browser", "Connected apps", "Create a token"]);
    expect(screen.getByRole("region", { name: "Sign in with your browser" })).toHaveTextContent(
      CANONICAL_MCP_RESOURCE
    );
  });
});

describe("Sign in with your browser", () => {
  it("gives each client the MCP URL and no token or Authorization header", () => {
    render(<AgentOAuthSetup mcpUrl={MCP_URL} />);
    const section = screen.getByRole("region", { name: "Sign in with your browser" });
    const snippets = within(section).getAllByRole("region");
    expect(snippets).toHaveLength(3);
    for (const snippet of snippets) {
      expect(snippet).toHaveTextContent(MCP_URL);
      expect(snippet.textContent).not.toMatch(/authorization|bearer|token|co_pat_|co_oat_/i);
      expect(snippet.textContent).not.toContain(AGENT_TOKEN_PREFIX);
    }
    expect(within(section).getByText(`claude mcp add --transport http careerotter ${MCP_URL}`)).toBeInTheDocument();
    expect(section).toHaveTextContent("Settings > Connectors > Add custom connector");
    expect(section).toHaveTextContent("/mcp");
    expect(section).toHaveTextContent("~/.cursor/mcp.json");
    expect(section).toHaveTextContent(".cursor/mcp.json in one project");
    const cursor = within(section).getByRole("region", { name: "Cursor (mcp.json)" });
    const parsed: unknown = JSON.parse(cursor.textContent ?? "");
    expect(parsed).toEqual({ mcpServers: { careerotter: { url: MCP_URL } } });
  });
});

describe("Connected apps list", () => {
  it("shows each app's name, where it sends you back, scopes, dates and status", async () => {
    await renderWithApps([LOOPBACK_APP, REVOKED_APP]);
    const list = appsList();
    expect(within(list).getByText("Claude Code")).toBeInTheDocument();
    expect(within(list).getByText("an app on this computer (localhost:33418)")).toBeInTheDocument();
    expect(within(list).getByText("claude.ai")).toBeInTheDocument();
    expect(within(list).getAllByText(/sends you back to/i)).toHaveLength(2);
    expect(within(list).getByText("Wins: read, Wins: write")).toBeInTheDocument();
    expect(within(list).getByText("Career profile: read")).toBeInTheDocument();
    expect(within(list).getAllByText("Connected")).toHaveLength(2);
    expect(within(list).getByText("Never")).toBeInTheDocument();
    expect(within(list).getByText("Active")).toBeInTheDocument();
    expect(within(list).getByText("Revoked")).toBeInTheDocument();
    // Only the active app can be revoked.
    expect(within(list).getAllByRole("button", { name: /^revoke /i })).toHaveLength(1);
  });

  it("says so when no apps are connected", async () => {
    await renderWithApps([]);
    expect(screen.getByText("No apps connected yet.")).toBeInTheDocument();
  });

  it("shows a load failure with Try again", async () => {
    script(`GET ${GRANTS_URL}`, { error: "Failed to load connected apps" }, HTTP.serverError);
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [LOOPBACK_APP] });
    script(`GET ${TOKENS_URL}`, { tokens: [] });
    renderAgents(true);
    expect(await screen.findByText("Failed to load connected apps")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("list", { name: "Connected apps" })).toBeInTheDocument();
  });
});

describe("revoking an app", () => {
  it("asks for confirmation before revoking, then re-reads the list", async () => {
    await renderWithApps([LOOPBACK_APP, REVOKED_APP]);
    const grantsBefore = calls(`GET ${GRANTS_URL}`);
    fireEvent.click(screen.getByRole("button", { name: revokeName("Claude Code") }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent(`Revoke "${isolateBidi("Claude Code")}"?`);
    expect(dialog).toHaveTextContent("This app loses access right away.");
    expect(calls(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`)).toBe(0);

    script(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`, { success: true });
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [{ ...LOOPBACK_APP, status: "revoked" }, REVOKED_APP] });
    await confirmInDialog("Revoke");

    await waitFor(() => expect(calls(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`)).toBe(1));
    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(grantsBefore + 1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: revokeName("Claude Code") })).not.toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Connected apps" })).toHaveFocus());
  });

  it("does not revoke when the confirmation is cancelled", async () => {
    await renderWithApps([LOOPBACK_APP]);
    fireEvent.click(screen.getByRole("button", { name: revokeName("Claude Code") }));
    await confirmInDialog("Cancel");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`)).toBe(0);
  });

  it("isolates the app's name in the button label and the dialog title", async () => {
    const rtlName = "\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 2";
    await renderWithApps([{ ...LOOPBACK_APP, clientName: rtlName }]);
    const button = screen.getByRole("button", { name: revokeName(rtlName) });
    expect(button.getAttribute("aria-label")).toBe(`Revoke \u2068${rtlName}\u2069`);
    fireEvent.click(button);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading").textContent).toBe(`Revoke "\u2068${rtlName}\u2069"?`);
  });

  it("shows a revoke failure inline and re-reads the list", async () => {
    await renderWithApps([LOOPBACK_APP]);
    const grantsBefore = calls(`GET ${GRANTS_URL}`);
    script(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`, { error: "Connected app not found" }, HTTP.notFound);
    // Revoked elsewhere in the meantime.
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [{ ...LOOPBACK_APP, status: "revoked" }] });
    fireEvent.click(screen.getByRole("button", { name: revokeName("Claude Code") }));
    await confirmInDialog("Revoke");
    expect(await screen.findByRole("alert")).toHaveTextContent("Connected app not found");
    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(grantsBefore + 1));
    await waitFor(() =>
      expect(within(appsList()).queryByRole("button", { name: /^revoke /i })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Connected app not found");
  });
});

describe("Revoke all agent access", () => {
  it("is offered when only a connected app is active, with copy covering apps", async () => {
    await renderWithApps([LOOPBACK_APP], [{ ...ACTIVE_TOKEN, status: "revoked" }]);
    const section = screen.getByRole("region", { name: "Revoke all agent access" });
    fireEvent.click(within(section).getByRole("button", { name: "Revoke all agent access" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Revoke all agent access?");
    expect(dialog).toHaveTextContent("Every agent token and connected app loses access right away.");
  });

  it("is not offered when no token or app is active", async () => {
    await renderWithApps([REVOKED_APP], [{ ...ACTIVE_TOKEN, status: "revoked" }]);
    expect(screen.queryByRole("button", { name: /revoke all/i })).not.toBeInTheDocument();
  });

  it("reloads the apps list", async () => {
    await renderWithApps([LOOPBACK_APP]);
    const grantsBefore = calls(`GET ${GRANTS_URL}`);
    script(`DELETE ${TOKENS_URL}`, { revoked: 2, tokensRevoked: 1, grantsRevoked: 1 });
    script(`GET ${TOKENS_URL}`, { tokens: [{ ...ACTIVE_TOKEN, status: "revoked" }] });
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [{ ...LOOPBACK_APP, status: "revoked" }] });

    fireEvent.click(screen.getByRole("button", { name: "Revoke all agent access" }));
    await confirmInDialog("Revoke all");

    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(grantsBefore + 1));
    await waitFor(() =>
      expect(within(appsList()).queryByRole("button", { name: /^revoke /i })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("status")).toHaveTextContent("All agent access revoked.");
  });

  it("re-reads both lists after a partial failure and keeps the error shown", async () => {
    await renderWithApps([LOOPBACK_APP]);
    const tokensBefore = calls(`GET ${TOKENS_URL}`);
    const grantsBefore = calls(`GET ${GRANTS_URL}`);
    script(
      `DELETE ${TOKENS_URL}`,
      { error: "Failed to revoke everything. Try again.", tokensRevoked: 1, grantsRevoked: null },
      HTTP.serverError
    );
    script(`GET ${TOKENS_URL}`, { tokens: [{ ...ACTIVE_TOKEN, status: "revoked" }] });

    fireEvent.click(screen.getByRole("button", { name: "Revoke all agent access" }));
    await confirmInDialog("Revoke all");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to revoke everything. Try again.");
    await waitFor(() => expect(calls(`GET ${TOKENS_URL}`)).toBe(tokensBefore + 1));
    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(grantsBefore + 1));
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Agent tokens" })).queryByRole("button", {
          name: /^revoke /i,
        })
      ).not.toBeInTheDocument()
    );
    // The app is still active, so it can be retried.
    expect(screen.getByRole("button", { name: "Revoke all agent access" })).toBeEnabled();
    expect(screen.getAllByRole("alert")).toEqual([alert]);
  });

  it("clears a stale app revoke error once it reloads the apps list", async () => {
    await renderWithApps([LOOPBACK_APP]);
    script(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`, { error: "Failed to revoke connected app" }, HTTP.serverError);
    fireEvent.click(screen.getByRole("button", { name: revokeName("Claude Code") }));
    await confirmInDialog("Revoke");
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to revoke connected app");

    script(`DELETE ${TOKENS_URL}`, { revoked: 2, tokensRevoked: 1, grantsRevoked: 1 });
    script(`GET ${TOKENS_URL}`, { tokens: [{ ...ACTIVE_TOKEN, status: "revoked" }] });
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [{ ...LOOPBACK_APP, status: "revoked" }] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Revoke all agent access" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Revoke all agent access" }));
    await confirmInDialog("Revoke all");
    await screen.findByRole("status");
    expect(screen.queryByText("Failed to revoke connected app")).not.toBeInTheDocument();
  });
});

describe("session expired", () => {
  it("shows one sign-in alert when both lists get a 401", async () => {
    script(`GET ${GRANTS_URL}`, { error: "Unauthorized" }, HTTP.unauthorized);
    script(`GET ${TOKENS_URL}`, { error: "Unauthorized" }, HTTP.unauthorized);
    renderAgents(true);
    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(1));
    await waitFor(() => expect(calls(`GET ${TOKENS_URL}`)).toBe(1));
    const alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.queryByText(/loading connected/i)).not.toBeInTheDocument()
    );
    expect(screen.getAllByRole("alert")).toEqual([alert]);
    expect(alert).toHaveTextContent("Your session expired. Sign in again.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no axe violations with the setup and the apps list", async () => {
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [LOOPBACK_APP, REVOKED_APP] });
    script(`GET ${TOKENS_URL}`, { tokens: [ACTIVE_TOKEN] });
    const { container } = await renderPage(true);
    await screen.findByRole("list", { name: "Connected apps" });
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });
});
