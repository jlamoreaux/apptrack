/**
 * Connected agents: the token list, the create form's scope/expiry rules and
 * validation, the show-once reveal, confirm-before-revoke, focus management,
 * and API failure handling (session expiry, rate limits, network).
 */

import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { ConnectedAgents } from "@/components/careerotter/connected-agents";
import {
  AGENT_TOKEN_CHECKSUM_LENGTH,
  AGENT_TOKEN_PREFIX,
  DEFAULT_AGENT_TOKEN_EXPIRY_DAYS,
} from "@/lib/constants/agent-access";
import { AGENT_ACCESS_FIELD_COPY, AGENT_SETUP_INSECURE_NOTICE, NEVER_EXPIRES } from "@/lib/constants/agent-access-ui";
import type { AgentTokenRecord } from "@/types";

const SITE = "https://careerotter.test";
// base64url of 32 bytes. The fixture is assembled at runtime from obviously
// fake parts so secret scanners do not flag a literal full-length token.
const FAKE_SECRET_LENGTH = 43;
const RAW_TOKEN = [
  AGENT_TOKEN_PREFIX,
  "x".repeat(FAKE_SECRET_LENGTH),
  "_",
  "0".repeat(AGENT_TOKEN_CHECKSUM_LENGTH),
].join("");
const TOKENS_URL = "/api/careerotter/agent-tokens";
const SIGN_IN_HREF = "/login?redirectTo=/dashboard/data";
const DEFAULT_EXPIRY_VALUE = String(DEFAULT_AGENT_TOKEN_EXPIRY_DAYS);
const LONG_UNBROKEN_NAME = "x".repeat(60);

const HTTP = {
  ok: 200,
  created: 201,
  multipleChoices: 300,
  unauthorized: 401,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
  serverError: 500,
} as const;

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

const EXPIRED: AgentTokenRecord = {
  ...ACTIVE,
  id: "44444444-4444-4444-8444-444444444444",
  name: "Expired agent",
  expires_at: "2026-09-05T12:00:00Z",
  status: "expired",
};

const CREATED: AgentTokenRecord = {
  ...ACTIVE,
  id: "33333333-3333-4333-8333-333333333333",
  name: "New",
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

let fetchMock: jest.SpiedFunction<typeof fetch>;

function respond(body: unknown, status: number = HTTP.ok): void {
  fetchMock.mockResolvedValueOnce(new TestResponse(body, status));
}

function mockList(tokens: AgentTokenRecord[]): void {
  respond({ tokens });
}

function requestAt(index: number): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`no fetch call at index ${index}`);
  const [url, init] = call;
  if (typeof url !== "string" || init === undefined) {
    throw new Error("fetch was called with unexpected arguments");
  }
  return { url, init };
}

function jsonBody(init: RequestInit): unknown {
  if (typeof init.body !== "string") throw new Error("request body is not a string");
  const parsed: unknown = JSON.parse(init.body);
  return parsed;
}

async function renderLoaded(tokens: AgentTokenRecord[] = [ACTIVE, REVOKED]): Promise<void> {
  mockList(tokens);
  render(<ConnectedAgents appUrl={SITE} />);
  await screen.findByRole("form", { name: /create an agent token/i });
}

function checkbox(name: string): HTMLElement {
  return screen.getByRole("checkbox", { name });
}

function nameInput(): HTMLElement {
  return screen.getByRole("textbox", { name: "Name" });
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

function submitCreate(name: string): void {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: /create token/i }));
}

/** Creates a token; the list re-fetched afterwards contains `listAfter`. */
async function createToken(listAfter: AgentTokenRecord[] = [CREATED, ACTIVE, REVOKED]): Promise<void> {
  respond({ token: RAW_TOKEN, record: CREATED }, HTTP.created);
  mockList(listAfter);
  submitCreate(CREATED.name);
  await screen.findByLabelText(/your new token/i);
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

async function confirmInDialog(buttonName: string): Promise<void> {
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: buttonName }));
}

beforeEach(() => {
  fetchMock = jest.spyOn(global, "fetch");
  fetchMock.mockReset();
  // Any request a test did not script fails like a dropped connection.
  fetchMock.mockRejectedValue(new Error("unexpected fetch"));
});

describe("ConnectedAgents list", () => {
  it("renders tokens from the API with plain-text scopes and Never for null dates", async () => {
    await renderLoaded();
    expect(requestAt(0)).toEqual({
      url: TOKENS_URL,
      init: expect.objectContaining({ method: "GET" }),
    });
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
    expect(within(list).getAllByRole("button", { name: /^revoke /i })).toHaveLength(1);
  });

  it("says so when no agents are connected", async () => {
    await renderLoaded([]);
    expect(screen.getByText("No agents connected yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke all/i })).not.toBeInTheDocument();
  });

  it("announces loading politely rather than as a status badge", () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
    render(<ConnectedAgents appUrl={SITE} />);
    const loading = screen.getByText(/loading connected agents/i);
    expect(loading).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a load error inline with a Try again button that reloads", async () => {
    respond({ error: "Something went wrong" }, HTTP.serverError);
    render(<ConnectedAgents appUrl={SITE} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");

    mockList([ACTIVE]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Claude Code laptop")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("offers Try again when the network request fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ConnectedAgents appUrl={SITE} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach careerotter/i);
    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass("min-h-11");
  });

  it("asks the user to sign in again when the session expired", async () => {
    respond({ error: "Unauthorized" }, HTTP.unauthorized);
    render(<ConnectedAgents appUrl={SITE} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your session expired. Sign in again.");
    expect(within(alert).getByRole("link", { name: /sign in again/i })).toHaveAttribute(
      "href",
      SIGN_IN_HREF
    );
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("hides Revoke all when no token is active", async () => {
    await renderLoaded([REVOKED, EXPIRED]);
    expect(screen.queryByRole("button", { name: /revoke all/i })).not.toBeInTheDocument();
  });

  it("wraps long unbroken names in the row and the confirm dialog title", async () => {
    // jsdom cannot measure layout, so assert the wrapping classes are applied.
    await renderLoaded([{ ...ACTIVE, name: LONG_UNBROKEN_NAME }]);
    const row = screen.getByText(LONG_UNBROKEN_NAME).parentElement;
    expect(row).toHaveClass("min-w-0", "break-words");

    fireEvent.click(screen.getByRole("button", { name: `Revoke ${LONG_UNBROKEN_NAME}` }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: /revoke/i })).toHaveClass(
      "min-w-0",
      "break-words"
    );
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

  it("gives every scope label a 44px tap target", async () => {
    await renderLoaded();
    for (const label of ["Wins: read", "Wins: write", "Career profile: read", "Comp: read", "Comp: write"]) {
      expect(screen.getByText(label, { selector: "label" })).toHaveClass("min-h-11");
    }
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
    fireEvent.change(expirySelect(), { target: { value: NEVER_EXPIRES } });
    expect(expirySelect().value).toBe(NEVER_EXPIRES);
    expect(neverOption()).not.toBeDisabled();

    fireEvent.click(checkbox("Comp: read"));
    expect(neverOption()).toBeDisabled();
    expect(expirySelect().value).toBe(DEFAULT_EXPIRY_VALUE);
    expect(screen.getByText(AGENT_ACCESS_FIELD_COPY.compMustExpire)).toBeInTheDocument();
  });

  it("marks the name as required", async () => {
    await renderLoaded();
    expect(nameInput()).toBeRequired();
    expect(nameInput()).toHaveAttribute("aria-required", "true");
  });

  it("sends a normalized name with the selected scopes and expiry, then re-reads the list", async () => {
    await renderLoaded();
    fireEvent.change(expirySelect(), { target: { value: NEVER_EXPIRES } });
    respond({ token: RAW_TOKEN, record: CREATED }, HTTP.created);
    mockList([CREATED, ACTIVE]);
    submitCreate("  My\tnew   agent ");
    await screen.findByLabelText(/your new token/i);

    const { url, init } = requestAt(1);
    expect(url).toBe(TOKENS_URL);
    expect(init.method).toBe("POST");
    expect(jsonBody(init)).toEqual({
      name: "My new agent",
      scopes: ["wins:read", "wins:write"],
      expires_in_days: null,
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(requestAt(2).init.method).toBe("GET");
    // The re-read list drops REVOKED, which a local patch would have kept.
    await waitFor(() => expect(screen.queryByText("Old agent")).not.toBeInTheDocument());
  });

  it("explains an empty name instead of submitting", async () => {
    await renderLoaded();
    submitCreate("   ");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Enter a name for this token.");
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(nameInput()).toHaveAttribute("aria-describedby", alert.id);
    expect(nameInput()).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a missing scope instead of submitting", async () => {
    await renderLoaded();
    fireEvent.click(checkbox("Wins: read"));
    submitCreate("New");
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose at least one/i);
    expect(checkbox("Wins: read")).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the active-token limit error inline", async () => {
    await renderLoaded();
    respond({ error: "You already have 10 active tokens" }, HTTP.unprocessable);
    submitCreate("New");
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have 10 active tokens");
    expect(screen.queryByLabelText(/your new token/i)).not.toBeInTheDocument();
  });

  it("ties a duplicate-name rejection to the name field", async () => {
    await renderLoaded();
    respond({ error: "An active token with this name already exists" }, HTTP.conflict);
    submitCreate(ACTIVE.name);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("An active token with this name already exists");
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(nameInput()).toHaveAttribute("aria-describedby", alert.id);
    expect(nameInput()).toHaveFocus();

    fireEvent.change(nameInput(), { target: { value: "Another name" } });
    expect(nameInput()).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adds a retry hint to a rate limit", async () => {
    await renderLoaded();
    respond({ error: "Too many requests" }, HTTP.tooManyRequests);
    submitCreate("New");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many requests. Try again in a minute."
    );
  });

  it("links to sign-in when the session expired during create", async () => {
    await renderLoaded();
    respond({ error: "Unauthorized" }, HTTP.unauthorized);
    submitCreate("New");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("link", { name: /sign in again/i })).toHaveAttribute(
      "href",
      SIGN_IN_HREF
    );
  });

  it("clears a stale revoke error after a successful create", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    respond({ error: "Something went wrong" }, HTTP.serverError);
    await confirmInDialog("Revoke all");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");

    await createToken();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});

describe("ConnectedAgents reveal", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
    jest.restoreAllMocks();
  });

  it("moves focus to the reveal heading after create", async () => {
    await renderLoaded();
    await createToken();
    expect(screen.getByRole("heading", { name: "Token created" })).toHaveFocus();
  });

  it("shows the token once and clears it on I've saved it", async () => {
    await renderLoaded();
    await createToken();
    const input = screen.getByLabelText(/your new token/i);
    expect(input).toHaveValue(RAW_TOKEN);
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
    expect(await screen.findByText(CREATED.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(screen.queryByLabelText(/your new token/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(RAW_TOKEN)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(RAW_TOKEN);
    expect(screen.getByRole("form", { name: /create an agent token/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Create a token" })).toHaveFocus()
    );
  });

  it("prompts before unload only while the token is shown", async () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");
    await renderLoaded();
    await createToken();

    const added = addSpy.mock.calls.find(([type]) => type === "beforeunload");
    if (!added) throw new Error("beforeunload listener was not added");
    const [, listener] = added;

    fireEvent.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", listener);
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

  it("shows the manual-copy fallback when the clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await renderLoaded();
    await createToken();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(
      await screen.findByText("Copy failed. Select the token and copy it manually.")
    ).toBeInTheDocument();
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

  it("shows a notice instead of setup snippets when the site is not served over HTTPS", async () => {
    mockList([ACTIVE]);
    render(<ConnectedAgents appUrl="http://careerotter.test" />);
    await screen.findByRole("form", { name: /create an agent token/i });
    await createToken();
    expect(screen.getByText(AGENT_SETUP_INSECURE_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Claude Code" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("http://careerotter.test/api/mcp");
  });

  it("setup snippets never contain the raw token and use the server-provided URL", async () => {
    await renderLoaded();
    await createToken();
    const snippets = screen.getAllByRole("region").filter((region) => region.tagName === "PRE");
    expect(snippets.map((snippet) => snippet.textContent ?? "").join("\n")).not.toContain(RAW_TOKEN);

    const claudeCode = screen.getByRole("region", { name: "Claude Code" });
    expect(claudeCode).toHaveTextContent(
      `claude mcp add --transport http careerotter ${SITE}/api/mcp --header "Authorization: Bearer $CAREEROTTER_TOKEN"`
    );
    expect(
      screen.getByRole("region", { name: "Claude Code project config (.mcp.json)" })
    ).toHaveTextContent("Bearer ${CAREEROTTER_TOKEN}");
    expect(
      screen.getByRole("region", { name: /claude desktop/i })
    ).toHaveTextContent("Authorization:${CAREEROTTER_AUTH_HEADER}");
    expect(screen.getByRole("region", { name: "Other clients" })).toHaveTextContent(
      "Authorization: Bearer <token>"
    );
  });
});

describe("ConnectedAgents revoke", () => {
  it("revokes one token only after confirmation, then re-reads the list", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code laptop" }));
    await screen.findByRole("alertdialog");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    respond({ success: true });
    mockList([{ ...ACTIVE, revoked_at: REVOKED.revoked_at, status: "revoked" }, REVOKED]);
    await confirmInDialog("Revoke");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const { url, init } = requestAt(1);
    expect(url).toBe(`${TOKENS_URL}/${ACTIVE.id}`);
    expect(init.method).toBe("DELETE");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^revoke /i })).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Your agent tokens" })).toHaveFocus()
    );
  });

  it("does not revoke when the confirmation is cancelled", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code laptop" }));
    await confirmInDialog("Cancel");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("revoke all asks for confirmation, then re-reads the list", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/revoke all agent tokens/i);
    expect(dialog).toHaveTextContent("Every connected agent loses access right away.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    respond({ revoked: 1 });
    mockList([{ ...ACTIVE, revoked_at: REVOKED.revoked_at, status: "revoked" }, REVOKED]);
    await confirmInDialog("Revoke all");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const { url, init } = requestAt(1);
    expect(url).toBe(TOKENS_URL);
    expect(init.method).toBe("DELETE");
    expect(requestAt(2).init.method).toBe("GET");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Revoke all" })).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Your agent tokens" })).toHaveFocus()
    );
  });

  describe("overlapping refreshes resolving out of order", () => {
    const revokedActive: AgentTokenRecord = {
      ...ACTIVE,
      revoked_at: REVOKED.revoked_at,
      status: "revoked",
    };

    /**
     * Creates a token whose list refresh stays pending, then revokes ACTIVE,
     * whose refresh also stays pending. Returns both pending list responses.
     */
    async function startTwoRefreshes(): Promise<{
      older: Deferred<Response>;
      newer: Deferred<Response>;
    }> {
      await renderLoaded([ACTIVE]);
      const older = deferred<Response>();
      respond({ token: RAW_TOKEN, record: CREATED }, HTTP.created);
      fetchMock.mockReturnValueOnce(older.promise);
      submitCreate(CREATED.name);
      await screen.findByLabelText(/your new token/i);

      const newer = deferred<Response>();
      fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Code laptop" }));
      respond({ success: true });
      fetchMock.mockReturnValueOnce(newer.promise);
      await confirmInDialog("Revoke");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
      return { older, newer };
    }

    it("keeps the newer list when the older one arrives last", async () => {
      const { older, newer } = await startTwoRefreshes();
      await act(async () => newer.resolve(new TestResponse({ tokens: [CREATED, revokedActive] }, HTTP.ok)));
      await act(async () => older.resolve(new TestResponse({ tokens: [CREATED, ACTIVE] }, HTTP.ok)));

      const list = screen.getByRole("list", { name: /agent tokens/i });
      expect(
        within(list).queryByRole("button", { name: "Revoke Claude Code laptop" })
      ).not.toBeInTheDocument();
      expect(within(list).getByRole("button", { name: "Revoke New" })).toBeInTheDocument();
    });

    it("ignores an older refresh failure that arrives after a newer success", async () => {
      const { older, newer } = await startTwoRefreshes();
      await act(async () => newer.resolve(new TestResponse({ tokens: [CREATED, revokedActive] }, HTTP.ok)));
      await act(async () =>
        older.resolve(new TestResponse({ error: "Something went wrong" }, HTTP.serverError))
      );

      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Revoke New" })).toBeInTheDocument();
    });
  });

  it("shows a revoke failure inline", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    respond({ error: "Something went wrong" }, HTTP.serverError);
    await confirmInDialog("Revoke all");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("ConnectedAgents accessibility", () => {
  it("has no axe violations with a list and the create form", async () => {
    mockList([ACTIVE, REVOKED]);
    const { container } = render(<ConnectedAgents appUrl={SITE} />);
    await screen.findByRole("form", { name: /create an agent token/i });
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations on the reveal panel", async () => {
    mockList([]);
    const { container } = render(<ConnectedAgents appUrl={SITE} />);
    await screen.findByRole("form", { name: /create an agent token/i });
    await createToken([CREATED]);
    await screen.findByText(CREATED.name);
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations with a rejected name", async () => {
    mockList([ACTIVE]);
    const { container } = render(<ConnectedAgents appUrl={SITE} />);
    await screen.findByRole("form", { name: /create an agent token/i });
    respond({ error: "An active token with this name already exists" }, HTTP.conflict);
    submitCreate(ACTIVE.name);
    await screen.findByRole("alert");
    expect(await axe(container, global.axeConfig)).toHaveNoViolations();
  });
});
