/**
 * Connected agents: the token list, the create form's scope/expiry rules, the
 * show-once reveal, and confirm-before-revoke.
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConnectedAgents } from "@/components/careerotter/connected-agents";
import type { AgentTokenRecord } from "@/types";

const SITE = "https://careerotter.test";
const RAW_TOKEN = "co_pat_secretsecretsecretsecretsecretsecretsec_0abc123";

const ACTIVE: AgentTokenRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Claude Code laptop",
  token_prefix: "co_pat_AbCdEfG",
  scopes: ["wins:read", "wins:write", "comp:read"],
  created_at: "2026-09-01T12:00:00Z",
  last_used_at: null,
  expires_at: "2026-11-30T12:00:00Z",
  revoked_at: null,
  status: "active",
};

const REVOKED: AgentTokenRecord = {
  ...ACTIVE,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Old agent",
  token_prefix: "co_pat_ZyXwVuT",
  scopes: ["career:read"],
  expires_at: null,
  revoked_at: "2026-09-10T12:00:00Z",
  status: "revoked",
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockList(tokens: AgentTokenRecord[]): void {
  mockFetch.mockResolvedValueOnce(jsonResponse({ tokens }));
}

async function renderLoaded(tokens: AgentTokenRecord[] = [ACTIVE, REVOKED]): Promise<void> {
  mockList(tokens);
  render(<ConnectedAgents siteUrl={SITE} />);
  await screen.findByRole("form", { name: /create an agent token/i });
}

function checkbox(name: string): HTMLElement {
  return screen.getByRole("checkbox", { name });
}

function expirySelect(): HTMLSelectElement {
  const select = screen.getByLabelText(/expires after/i);
  if (!(select instanceof HTMLSelectElement)) throw new Error("expiry is not a select");
  return select;
}

function neverOption(): HTMLOptionElement {
  const option = within(expirySelect()).getByRole("option", { name: "Never" });
  if (!(option instanceof HTMLOptionElement)) throw new Error("not an option");
  return option;
}

async function createToken(): Promise<void> {
  mockFetch.mockResolvedValueOnce(
    jsonResponse(
      { token: RAW_TOKEN, record: { ...ACTIVE, id: "33333333-3333-4333-8333-333333333333", name: "New" } },
      201
    )
  );
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
  fireEvent.click(screen.getByRole("button", { name: /create token/i }));
  await screen.findByLabelText(/your new token/i);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ConnectedAgents list", () => {
  it("renders tokens from the API with plain-text scopes and Never for null dates", async () => {
    await renderLoaded();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/careerotter/agent-tokens",
      expect.objectContaining({ method: "GET" })
    );
    const list = screen.getByRole("list", { name: /agent tokens/i });
    expect(within(list).getByText("Claude Code laptop")).toBeInTheDocument();
    expect(within(list).getByText("co_pat_AbCdEfG")).toHaveClass("font-mono");
    expect(within(list).getByText("Wins: read, Wins: write, Comp: read")).toBeInTheDocument();
    expect(within(list).getByText("Career profile: read")).toBeInTheDocument();
    expect(within(list).getByText("Active")).toBeInTheDocument();
    expect(within(list).getByText("Revoked")).toBeInTheDocument();
    // last_used_at null on both, expires_at null on the revoked one
    expect(within(list).getAllByText("Never")).toHaveLength(3);
    // Only the active token can be revoked.
    expect(screen.getAllByRole("button", { name: /^revoke /i })).toHaveLength(1);
  });

  it("shows a load error inline", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "Something went wrong" }, 500));
    render(<ConnectedAgents siteUrl={SITE} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("hides Revoke all when every token is revoked", async () => {
    await renderLoaded([REVOKED]);
    expect(screen.queryByRole("button", { name: /revoke all/i })).not.toBeInTheDocument();
  });
});

describe("ConnectedAgents create form", () => {
  it("defaults to wins read and write", async () => {
    await renderLoaded();
    expect(checkbox("Wins: read")).toBeChecked();
    expect(checkbox("Wins: write")).toBeChecked();
    expect(checkbox("Career profile: read")).not.toBeChecked();
    expect(checkbox("Comp: read")).not.toBeChecked();
    expect(checkbox("Comp: write")).not.toBeChecked();
  });

  it("checking a write checks its read", async () => {
    await renderLoaded();
    fireEvent.click(checkbox("Comp: write"));
    expect(checkbox("Comp: write")).toBeChecked();
    expect(checkbox("Comp: read")).toBeChecked();
  });

  it("unchecking a read unchecks the write that implies it", async () => {
    await renderLoaded();
    fireEvent.click(checkbox("Wins: read"));
    expect(checkbox("Wins: read")).not.toBeChecked();
    expect(checkbox("Wins: write")).not.toBeChecked();
  });

  it("checking a comp scope disables Never and resets it to the default", async () => {
    await renderLoaded();
    fireEvent.change(expirySelect(), { target: { value: "never" } });
    expect(expirySelect().value).toBe("never");
    expect(neverOption()).not.toBeDisabled();

    fireEvent.click(checkbox("Comp: read"));
    expect(neverOption()).toBeDisabled();
    expect(expirySelect().value).toBe("90");
    expect(screen.getByText(/comp access must expire/i)).toBeInTheDocument();
  });

  it("sends the selected name, scopes, and expiry", async () => {
    await renderLoaded();
    fireEvent.change(expirySelect(), { target: { value: "never" } });
    await createToken();
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe("/api/careerotter/agent-tokens");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "New",
      scopes: ["wins:read", "wins:write"],
      expires_in_days: null,
    });
  });

  it("shows the API error message inline", async () => {
    await renderLoaded();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "You already have 10 active tokens" }, 422)
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: /create token/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have 10 active tokens");
    expect(screen.queryByLabelText(/your new token/i)).not.toBeInTheDocument();
  });
});

describe("ConnectedAgents reveal", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
  });

  it("shows the token once and clears it on Done", async () => {
    await renderLoaded();
    await createToken();
    const input = screen.getByLabelText(/your new token/i);
    expect(input).toHaveValue(RAW_TOKEN);
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByLabelText(/your new token/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(RAW_TOKEN)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(RAW_TOKEN);
    expect(screen.getByRole("form", { name: /create an agent token/i })).toBeInTheDocument();
  });

  it("shows a manual-copy fallback when the clipboard write fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    await renderLoaded();
    await createToken();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(
      await screen.findByText("Copy failed. Select the token and copy it manually.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/your new token/i)).toHaveValue(RAW_TOKEN);
  });

  it("confirms a successful copy", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderLoaded();
    await createToken();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(RAW_TOKEN);
  });

  it("setup snippets reference $CAREEROTTER_TOKEN, never the raw token", async () => {
    await renderLoaded();
    await createToken();
    const snippets = Array.from(document.querySelectorAll("pre")).map((pre) => pre.textContent ?? "");
    expect(snippets.length).toBeGreaterThan(0);
    for (const snippet of snippets) {
      expect(snippet).not.toContain(RAW_TOKEN);
      expect(snippet).toContain("CAREEROTTER_TOKEN");
    }
    expect(snippets.join("\n")).toContain(
      `claude mcp add --transport http careerotter ${SITE}/api/mcp --header "Authorization: Bearer $CAREEROTTER_TOKEN"`
    );
  });
});

describe("ConnectedAgents revoke", () => {
  it("revokes one token only after confirmation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code laptop" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe(`/api/careerotter/agent-tokens/${ACTIVE.id}`);
    expect(init.method).toBe("DELETE");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^revoke /i })).not.toBeInTheDocument()
    );
  });

  it("does not revoke when the confirmation is cancelled", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code laptop" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("revoke all asks for confirmation before calling DELETE", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/revoke all agent tokens/i);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValueOnce(jsonResponse({ revoked: 1 }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke all" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe("/api/careerotter/agent-tokens");
    expect(init.method).toBe("DELETE");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Revoke all" })).not.toBeInTheDocument()
    );
  });

  it("shows a revoke failure inline", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    const dialog = await screen.findByRole("alertdialog");
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "Something went wrong" }, 500));
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke all" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("ConnectedAgents accessibility", () => {
  it("has no axe violations with a list and the create form", async () => {
    mockList([ACTIVE, REVOKED]);
    const { container } = render(<ConnectedAgents siteUrl={SITE} />);
    await screen.findByRole("form", { name: /create an agent token/i });
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations on the reveal panel", async () => {
    mockList([]);
    const { container } = render(<ConnectedAgents siteUrl={SITE} />);
    await screen.findByRole("form", { name: /create an agent token/i });
    await createToken();
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });
});
