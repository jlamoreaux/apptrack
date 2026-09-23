/**
 * Connected apps and the "Sign in with your browser" setup on the data page:
 * - OAuth disabled: neither is shown, and the grants API isn't called
 * - the list: name, where the app sends the user back (loopback text),
 *   scopes, dates and status; Revoke only for active apps
 * - revoking asks for confirmation first, then re-reads the list
 * - a revoke failure is shown inline
 * - revoke-all reloads the apps list too
 * - the setup snippets carry the MCP URL and no token or header
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConnectedAgents } from "@/components/careerotter/connected-agents";
import { AGENT_TOKEN_PREFIX } from "@/lib/constants/agent-access";
import type { AgentOAuthGrantSummary, AgentTokenRecord } from "@/types";

const SITE = "https://careerotter.test";
const MCP_URL = "https://careerotter.io/api/mcp";
const TOKENS_URL = "/api/careerotter/agent-tokens";
const GRANTS_URL = "/api/careerotter/agent-grants";

const HTTP = { ok: 200, multipleChoices: 300, serverError: 500 } as const;

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
  return render(<ConnectedAgents appUrl={SITE} oauthEnabled={oauthEnabled} mcpUrl={MCP_URL} />);
}

async function renderWithApps(grants: AgentOAuthGrantSummary[]): Promise<ReturnType<typeof render>> {
  script(`GET ${GRANTS_URL}`, { enabled: true, grants });
  script(`GET ${TOKENS_URL}`, { tokens: [ACTIVE_TOKEN] });
  const view = renderAgents(true);
  await screen.findByRole("form", { name: /create an agent token/i });
  await waitFor(() =>
    expect(screen.queryByText(/loading connected apps/i)).not.toBeInTheDocument()
  );
  return view;
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
});

describe("OAuth disabled", () => {
  it("shows neither the sign-in option nor the apps list, and never calls the grants API", async () => {
    script(`GET ${TOKENS_URL}`, { tokens: [ACTIVE_TOKEN] });
    renderAgents(false);
    await screen.findByRole("form", { name: /create an agent token/i });
    expect(screen.queryByRole("heading", { name: "Sign in with your browser" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connected apps" })).not.toBeInTheDocument();
    expect(calls(`GET ${GRANTS_URL}`)).toBe(0);
  });
});

describe("Sign in with your browser", () => {
  it("comes before the apps list and the token form", async () => {
    await renderWithApps([]);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings.slice(0, 3)).toEqual(["Sign in with your browser", "Connected apps", "Create a token"]);
  });

  it("gives each client the MCP URL and no token or Authorization header", async () => {
    await renderWithApps([]);
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
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Revoke "Claude Code"?');
    expect(dialog).toHaveTextContent("This app loses access right away.");
    expect(calls(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`)).toBe(0);

    script(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`, { success: true });
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [{ ...LOOPBACK_APP, status: "revoked" }, REVOKED_APP] });
    await confirmInDialog("Revoke");

    await waitFor(() => expect(calls(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`)).toBe(1));
    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(grantsBefore + 1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Revoke Claude Code" })).not.toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Connected apps" })).toHaveFocus());
  });

  it("does not revoke when the confirmation is cancelled", async () => {
    await renderWithApps([LOOPBACK_APP]);
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code" }));
    await confirmInDialog("Cancel");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`)).toBe(0);
  });

  it("shows a revoke failure inline", async () => {
    await renderWithApps([LOOPBACK_APP]);
    script(`DELETE ${GRANTS_URL}/${LOOPBACK_APP.id}`, { error: "Connected app not found" }, 404);
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code" }));
    await confirmInDialog("Revoke");
    expect(await screen.findByRole("alert")).toHaveTextContent("Connected app not found");
  });

  it("reloads the apps list after revoke all", async () => {
    await renderWithApps([LOOPBACK_APP]);
    const grantsBefore = calls(`GET ${GRANTS_URL}`);
    script(`DELETE ${TOKENS_URL}`, { revoked: 2, tokensRevoked: 1, grantsRevoked: 1 });
    script(`GET ${TOKENS_URL}`, { tokens: [{ ...ACTIVE_TOKEN, status: "revoked" }] });
    script(`GET ${GRANTS_URL}`, { enabled: true, grants: [{ ...LOOPBACK_APP, status: "revoked" }] });

    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    await confirmInDialog("Revoke all");

    await waitFor(() => expect(calls(`GET ${GRANTS_URL}`)).toBe(grantsBefore + 1));
    await waitFor(() =>
      expect(within(appsList()).queryByRole("button", { name: /^revoke /i })).not.toBeInTheDocument()
    );
  });
});

describe("accessibility", () => {
  it("has no axe violations with the setup and the apps list", async () => {
    const { container } = await renderWithApps([LOOPBACK_APP, REVOKED_APP]);
    expect(await axe(container)).toHaveNoViolations();
  });
});
