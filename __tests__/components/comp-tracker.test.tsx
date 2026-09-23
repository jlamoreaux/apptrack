/**
 * Comp tracker page: the empty state leads with the form, and with an entry
 * the page shows the headline, the projection (chart + table with the vest
 * split), the company behind the ticker, and a simulator whose moves are
 * relative to the live price and reflected everywhere.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { CompTracker } from "@/components/careerotter/comp-tracker";
import { readGuestComp, writeGuestComp } from "@/lib/careerotter/comp-guest-cache";
import { GUEST_COMP_STORAGE_KEY } from "@/lib/constants/careerotter";

// The guest save prompt renders a Google button that only needs a client at click time.
jest.mock("@/components/auth/google-signin-button", () => ({
  GoogleSignInButton: () => <button type="button">Continue with Google</button>,
}));

// Radix Select -> lightweight testable equivalent.
jest.mock("@/components/ui/select", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SelectTrigger: Pass,
    SelectValue: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    SelectContent: Pass,
    SelectItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const thisYear = new Date().getFullYear();
// A grant that started this January with a 12-month cliff: nothing has
// vested yet, so every projected stock dollar is unvested.
const entry = {
  id: "e1",
  effective_date: `${thisYear}-01-15`,
  base: 155000,
  bonus: 37000,
  equity: 0,
  currency: "USD",
  note: null,
  ticker: "NET",
  shares: 1200,
  vest_start: `${thisYear}-06-01`,
  vest_years: 4,
  vest_cliff_months: 12,
};

const quote = {
  price: 250,
  as_of: `${thisYear}-09-22T06:00:00Z`,
  change: 28.07,
  change_pct: 8.67,
  previous_close: 221.93,
  company_name: "Cloudflare Inc",
  exchange: "NEW YORK STOCK EXCHANGE, INC.",
  market_cap_musd: 88000,
  logo_url: null,
};

function respondWith(body: unknown) {
  mockFetch.mockResolvedValue({ ok: true, json: async () => body });
}

beforeEach(() => {
  mockFetch.mockReset();
  window.localStorage.clear();
});

it("leaves the loading state and says so when the first load is rejected", async () => {
  mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Unauthorized" }) });
  render(<CompTracker />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Could not load your comp/);
  expect(screen.queryByLabelText("Loading your comp")).not.toBeInTheDocument();
});

it("leaves the loading state and says so when the network fails", async () => {
  mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<CompTracker />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Check your connection/);
  expect(screen.queryByLabelText("Loading your comp")).not.toBeInTheDocument();
});

it("leads with the entry form when nothing is logged yet", async () => {
  respondWith({ entries: [], marketRange: null, isPro: false, prices: {}, priceFeedEnabled: false });
  render(<CompTracker />);
  expect(await screen.findByText("Start with what you make today")).toBeInTheDocument();
  expect(screen.getByLabelText("Base salary")).toBeInTheDocument();
  // Equity-as-shares and vesting are disclosures, closed by default.
  expect(screen.queryByLabelText("Ticker")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Vest years")).not.toBeInTheDocument();
  expect(screen.getByText(/market benchmark is a Pro feature/)).toBeInTheDocument();
});

it("opens the vest disclosure with the standard schedule pre-filled", async () => {
  respondWith({ entries: [], marketRange: null, isPro: false, prices: {}, priceFeedEnabled: false });
  render(<CompTracker />);
  await screen.findByText("Start with what you make today");
  fireEvent.click(screen.getByLabelText("It vests over time"));
  expect(screen.getByLabelText("Vest years")).toHaveValue(4);
  expect(screen.getByLabelText("Cliff (months)")).toHaveValue(12);
  fireEvent.click(screen.getByLabelText("It is stock in a public company"));
  expect(screen.getByLabelText("Ticker")).toBeInTheDocument();
  expect(screen.getByLabelText("Shares")).toBeInTheDocument();
});

describe("with a share-based entry and a live price", () => {
  beforeEach(() => {
    respondWith({
      entries: [entry],
      marketRange: null,
      isPro: false,
      prices: { NET: quote },
      priceFeedEnabled: true,
    });
  });

  it("shows annual total comp with equity annualized over the vest", async () => {
    render(<CompTracker />);
    // 155,000 + 37,000 + (1,200 * 250) / 4
    expect(await screen.findByText("Annual total comp")).toBeInTheDocument();
    // The headline, the simulator's readout and the trajectory row agree.
    expect(screen.getAllByText("$267,000")).toHaveLength(3);
  });

  it("projects three years as a chart with a legend and a table with the vest split", async () => {
    render(<CompTracker />);
    await screen.findByText("Projected comp");
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getByText("Salary")).toBeInTheDocument();
    expect(within(legend).getByText("Stock")).toBeInTheDocument();
    expect(within(legend).getByText("Incentives")).toBeInTheDocument();
    // Every column is a focusable readout of its year, out to the end of the
    // four-year vest that starts this year: five columns.
    for (let i = 0; i < 5; i++) {
      expect(screen.getByRole("button", { name: new RegExp(`^${thisYear + i}: total`) })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: new RegExp(`^${thisYear + 5}: total`) })).not.toBeInTheDocument();

    const table = screen.getByRole("table");
    // The vest starts this year and nothing has cleared the cliff, so the
    // vested / still-to-vest split would only repeat the Stock row.
    expect(within(table).getByText("Stock")).toBeInTheDocument();
    expect(within(table).queryByText("Vested so far")).not.toBeInTheDocument();
    expect(within(table).queryByText("Still to vest")).not.toBeInTheDocument();
    expect(within(table).getByText("Total comp")).toBeInTheDocument();
    expect(within(table).getByText("Est. take-home")).toBeInTheDocument();
  });

  it("explains that the headline averages the vest", async () => {
    render(<CompTracker />);
    expect(await screen.findByText(/An average year across the vest/)).toBeInTheDocument();
  });

  it("splits stock into vested and still to vest once part of the grant has vested", async () => {
    respondWith({
      entries: [{ ...entry, vest_start: `${thisYear - 2}-01-01` }],
      marketRange: null,
      isPro: false,
      prices: { NET: quote },
      priceFeedEnabled: true,
    });
    render(<CompTracker />);
    await screen.findByText("Projected comp");
    const table = screen.getByRole("table");
    expect(within(table).getByText("Vested so far")).toBeInTheDocument();
    expect(within(table).getByText("Still to vest")).toBeInTheDocument();
  });

  it("puts the market comparison in its own section", async () => {
    render(<CompTracker />);
    expect(await screen.findByText("Compare to the market")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax rate for take-home")).toHaveValue(30);
  });

  it("shows the company behind the ticker with its price and day move", async () => {
    render(<CompTracker />);
    expect(await screen.findByText("Cloudflare Inc")).toBeInTheDocument();
    expect(screen.getByText("NYSE: NET", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("$250.00")).toBeInTheDocument();
    expect(screen.getByText("+$28.07 (+8.67%) today")).toBeInTheDocument();
    expect(screen.getByText("$88B")).toBeInTheDocument();
    expect(screen.getByText(/Nothing vests until the cliff/)).toBeInTheDocument();
  });

  it("simulates price moves relative to the live price and resets", async () => {
    render(<CompTracker />);
    const input = (await screen.findByLabelText("Price per share")) as HTMLInputElement;
    expect(input).toHaveValue(250);

    fireEvent.click(screen.getByRole("button", { name: "+20%" }));
    expect(input).toHaveValue(300);
    expect(screen.getByText("+$50.00")).toBeInTheDocument();
    // Annual total: 155,000 + 37,000 + (1,200 * 300) / 4
    expect(screen.getAllByText("$282,000").length).toBeGreaterThan(0);

    // Moves are relative to the anchor, not compounding.
    fireEvent.click(screen.getByRole("button", { name: "+50%" }));
    expect(input).toHaveValue(375);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue(250);
    await waitFor(() => expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled());
  });

  it("lists the entry in the trajectory with its breakdown", async () => {
    render(<CompTracker />);
    await screen.findByText("Your trajectory");
    expect(screen.getByText(/1,200 NET shares/)).toBeInTheDocument();
    expect(screen.getByText(/4-year vest, 12-month cliff/)).toBeInTheDocument();
  });
});

it("ignores a stale reload that lands after a newer lookup has committed", async () => {
  const empty = { entries: [], marketRange: null, isPro: false, prices: {}, priceFeedEnabled: false };
  const withEntry = { ...empty, entries: [entry] };
  type Pending = { init?: RequestInit; resolve: (v: unknown) => void };
  const calls: Pending[] = [];
  mockFetch.mockImplementation(
    (_url: string, init?: RequestInit) => new Promise((resolve) => calls.push({ init, resolve }))
  );
  render(<CompTracker />);
  await waitFor(() => expect(calls).toHaveLength(1));
  calls[0].resolve({ ok: true, json: async () => empty });
  await screen.findByText("Start with what you make today");

  // Save an entry: the POST resolves, and the reload it triggers stays pending.
  fireEvent.change(screen.getByLabelText("Base salary"), { target: { value: "155000" } });
  fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1].init?.method).toBe("POST");
  calls[1].resolve({ ok: true, json: async () => ({ entry }) });
  await waitFor(() => expect(calls).toHaveLength(3));

  // A role change starts a newer lookup, which resolves first with the entry.
  fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Software Engineer" } });
  await waitFor(() => expect(calls).toHaveLength(4));
  calls[3].resolve({ ok: true, json: async () => withEntry });
  await screen.findByText("Annual total comp");

  // Now the older reload lands, empty. It must not win.
  calls[2].resolve({ ok: true, json: async () => empty });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getByText("Annual total comp")).toBeInTheDocument();
  expect(screen.queryByText("Start with what you make today")).not.toBeInTheDocument();
});

it("says why there is no price when the feed is off", async () => {
  respondWith({
    entries: [entry],
    marketRange: null,
    isPro: false,
    prices: {},
    priceFeedEnabled: false,
  });
  render(<CompTracker />);
  expect(await screen.findByText(/Live prices are not enabled here/)).toBeInTheDocument();
});

describe("guest mode", () => {
  it("keeps entries in the browser, prompts to sign up, and never hits the comp API", async () => {
    render(<CompTracker mode="guest" />);
    expect(await screen.findByText("Start with what you make today")).toBeInTheDocument();
    expect(screen.getByText(/stays in this browser for 24 hours/)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Base salary"), { target: { value: "155,000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("Annual total comp")).toBeInTheDocument();
    // The headline and the trajectory row agree.
    expect(screen.getAllByText("$155,000")).toHaveLength(2);
    expect(screen.getByText("Keep this")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up free" })).toHaveAttribute(
      "href",
      "/signup?redirectTo=%2Fdashboard%2Fcomp"
    );
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Fdashboard%2Fcomp"
    );
    expect(readGuestComp()).toHaveLength(1);
    expect(readGuestComp()[0].base).toBe(155000);
    // Still no API traffic: no ticker means no quote lookup either.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("restores cached entries and looks up their cached quotes, newest ticker first", async () => {
    // Seven older entries with their own tickers, then the current one: the
    // endpoint answers five per request, so the current ticker must lead.
    const older = ["A", "B", "C", "D", "E", "F", "G"].map((t, i) => ({
      ...entry,
      id: `old-${t}`,
      effective_date: `${thisYear - 8 + i}-01-15`,
      ticker: t,
      shares: 10,
    }));
    writeGuestComp([...older, { ...entry, id: "g1" }]);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ prices: { NET: quote }, priceFeedEnabled: true }) });
    render(<CompTracker mode="guest" />);
    expect(await screen.findByText("Cloudflare Inc")).toBeInTheDocument();
    const urls = mockFetch.mock.calls.map((c) => c[0] as string).sort();
    // Eight cached tickers, newest first, in batches of five: the newest
    // entry's ticker is always in the first request.
    expect(urls).toEqual([
      "/api/careerotter/stock-price?tickers=NET,G,F,E,D",
      "/api/careerotter/stock-price?tickers=C,B,A",
    ].sort());
  });

  it("says plainly when the guest's ticker has no cached price", async () => {
    writeGuestComp([{ ...entry, id: "g1" }]);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ prices: {}, priceFeedEnabled: true }) });
    render(<CompTracker mode="guest" />);
    expect(await screen.findByText(/No cached price for NET yet/)).toBeInTheDocument();
  });

  it("warns instead of promising a 24-hour hold when the browser refuses to store entries", async () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      render(<CompTracker mode="guest" />);
      await screen.findByText("Start with what you make today");
      fireEvent.change(screen.getByLabelText("Base salary"), { target: { value: "155,000" } });
      fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
      expect(await screen.findByText("Annual total comp")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/not storing your entry/);
      expect(screen.queryByText(/for the next 24 hours/)).not.toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });

  it("refuses an entry the API would reject, before it reaches the browser", async () => {
    render(<CompTracker mode="guest" />);
    await screen.findByText("Start with what you make today");
    fireEvent.change(screen.getByLabelText("Base salary"), { target: { value: "155,000" } });
    fireEvent.click(screen.getByLabelText("It vests over time"));
    fireEvent.change(screen.getByLabelText("Vest years"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Cliff (months)"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot exceed the vesting duration/);
    expect(readGuestComp()).toEqual([]);
  });

  it("deletes a guest entry from the browser", async () => {
    writeGuestComp([{ ...entry, id: "g1", ticker: null, shares: null }]);
    render(<CompTracker mode="guest" />);
    await screen.findByText("Your trajectory");
    fireEvent.click(screen.getByRole("button", { name: /^Delete comp entry/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm delete/ }));
    expect(await screen.findByText("Start with what you make today")).toBeInTheDocument();
    expect(window.localStorage.getItem(GUEST_COMP_STORAGE_KEY)).toBeNull();
  });
});

it("in account mode, saves entries left from a guest visit and then shows them", async () => {
  writeGuestComp([{ ...entry, id: "g1", ticker: null, shares: null }]);
  const empty = { entries: [], marketRange: null, isPro: false, prices: {}, priceFeedEnabled: false };
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? { ok: true, status: 201, json: async () => ({ entry }) }
      : {
          ok: true,
          status: 200,
          json: async () =>
            mockFetch.mock.calls.some((c) => c[1]?.method === "POST")
              ? { ...empty, entries: [{ ...entry, ticker: null, shares: null }] }
              : empty,
        }
  );
  render(<CompTracker />);
  expect(await screen.findByText("Annual total comp")).toBeInTheDocument();
  const post = mockFetch.mock.calls.find((c) => c[1]?.method === "POST");
  expect(post).toBeDefined();
  expect(JSON.parse(post![1].body)).not.toHaveProperty("id");
  expect(window.localStorage.getItem(GUEST_COMP_STORAGE_KEY)).toBeNull();
});
