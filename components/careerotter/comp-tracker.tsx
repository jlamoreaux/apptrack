"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketRange } from "@/lib/careerotter/market-data";
import {
  anchorSharePrice,
  annualBreakdown,
  annualizedTotal,
  formatCompactUsd,
  formatUsd,
  hasShares,
  projectComp,
  projectionYears,
  vestSummary,
  type CompEntry,
  type StockQuote,
} from "@/lib/careerotter/comp-projection";
import {
  newGuestId,
  readGuestComp,
  sortByDate,
  toCompEntry,
  writeGuestComp,
  type CompEntryInput,
  type GuestCompEntry,
} from "@/lib/careerotter/comp-guest-cache";
import { importGuestComp } from "@/lib/careerotter/comp-guest-import";
import { normalizeTickers } from "@/lib/careerotter/tickers";
import { CompanyCard } from "./comp/company-card";
import { CompEntryForm } from "./comp/entry-form";
import { GuestSavePrompt } from "./comp/guest-save-prompt";
import { HistoryList } from "./comp/history-list";
import { MarketComparison, resolveRoleFamily } from "./comp/market-comparison";
import { PriceSimulator } from "./comp/price-simulator";
import { ProjectionChart } from "./comp/projection-chart";
import { ProjectionTable } from "./comp/projection-table";

// The projection math lives in lib/careerotter/comp-projection; these stay
// exported here for callers that imported them from the component.
export { addMonthsClamped, grantFractionReceivedInYear } from "@/lib/careerotter/comp-projection";

interface CompResponse {
  entries: CompEntry[];
  marketRange: MarketRange | null;
  isPro: boolean;
  prices?: Record<string, StockQuote>;
  priceFeedEnabled?: boolean;
}

interface QuoteResponse {
  prices?: Record<string, StockQuote>;
  priceFeedEnabled?: boolean;
}

interface CompTrackerProps {
  /**
   * "account": entries live in the API and the page is behind login.
   * "guest": entries live in this browser for a day; the page prompts the
   * visitor to sign up, and the account then imports them.
   */
  mode?: "account" | "guest";
}

/** True for the DOMException fetch throws when its signal is aborted. */
function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}

/** Card heading with an optional one-line hint under it. */
function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The comp page. Everything is driven by the latest entry: the headline is
 * its annual total comp (equity annualized over the vest), the projection is
 * how it actually pays out over the next three years, and the simulator's
 * share price feeds both. Tracking is free; the market benchmark is Pro and
 * the API decides. A guest gets the same page with entries kept in the
 * browser until they sign up.
 */
export function CompTracker({ mode = "account" }: CompTrackerProps) {
  const isGuest = mode === "guest";
  const [loaded, setLoaded] = useState(false);
  const [entries, setEntries] = useState<CompEntry[]>([]);
  const [marketRange, setMarketRange] = useState<MarketRange | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [prices, setPrices] = useState<Record<string, StockQuote>>({});
  const [priceFeedEnabled, setPriceFeedEnabled] = useState(false);
  const [roleTitle, setRoleTitle] = useState("");
  const [level, setLevel] = useState("");
  const [scenarioPrice, setScenarioPrice] = useState<number | null>(null);
  // Effective tax rate for the take-home row. An estimate the user controls;
  // no jurisdiction math, no pretending to know their tax situation.
  const [taxRate, setTaxRate] = useState(30);
  const [error, setError] = useState("");
  // The guest's entries as stored; `entries` mirrors them in render shape.
  const guestEntries = useRef<GuestCompEntry[]>([]);

  // Every load, whether from the role lookup or a save, takes a ticket; only
  // the newest ticket may commit state, so a slow older response can never
  // overwrite a newer one (the lookup effect also aborts its own predecessor).
  const requestTicket = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const ticket = ++requestTicket.current;
      const isCurrent = () => ticket === requestTicket.current;
      const roleFamily = resolveRoleFamily(roleTitle);
      const qs = new URLSearchParams();
      if (roleFamily) qs.set("roleFamily", roleFamily);
      if (level) qs.set("level", level);
      try {
        const res = await fetch(`/api/careerotter/comp?${qs.toString()}`, { signal });
        if (!isCurrent()) return;
        if (res.ok) {
          const data = (await res.json()) as CompResponse;
          if (!isCurrent()) return;
          setEntries(data.entries);
          setMarketRange(data.marketRange);
          setIsPro(data.isPro);
          setPrices(data.prices ?? {});
          setPriceFeedEnabled(Boolean(data.priceFeedEnabled));
          setError("");
        } else {
          setError("Could not load your comp. Reload the page to try again.");
        }
        setLoaded(true);
      } catch (err) {
        // A superseded or unmounted lookup aborts; keep the current state and
        // let the newer request settle it. Anything else must not leave the
        // page on its skeleton forever.
        if (isAbortError(err) || !isCurrent()) return;
        setError("Could not load your comp. Check your connection and reload.");
        setLoaded(true);
      }
    },
    [roleTitle, level]
  );

  // Debounce the free-text role lookup and abort the in-flight request, so a
  // slow older response can't overwrite a newer one (roleTitle changes per keystroke).
  useEffect(() => {
    if (isGuest) return;
    const controller = new AbortController();
    const timer = setTimeout(() => load(controller.signal), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, isGuest]);

  // Signed in with entries left over from a guest visit: save them, then show them.
  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    importGuestComp().then((result) => {
      if (!cancelled && result && result.imported > 0) load();
    });
    return () => {
      cancelled = true;
    };
    // Once per mount; the cache decides whether there is anything to do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  /** Guest prices come from the public cache of quotes; a miss is fine. */
  const loadGuestQuotes = useCallback(async (tickers: string[]) => {
    const wanted = normalizeTickers(tickers);
    if (wanted.length === 0) return;
    try {
      const res = await fetch(`/api/careerotter/stock-price?tickers=${wanted.join(",")}`);
      if (!res.ok) return;
      const data = (await res.json()) as QuoteResponse;
      setPrices((prev) => ({ ...prev, ...(data.prices ?? {}) }));
      setPriceFeedEnabled(Boolean(data.priceFeedEnabled));
    } catch {
      // No price, no problem: the simulator falls back to the typed price.
    }
  }, []);

  // A guest's entries come from the browser, and the page is never "loading".
  useEffect(() => {
    if (!isGuest) return;
    const cached = readGuestComp();
    guestEntries.current = cached;
    setEntries(cached.map(toCompEntry));
    setLoaded(true);
    loadGuestQuotes(cached.map((e) => e.ticker ?? ""));
  }, [isGuest, loadGuestQuotes]);

  const latest = entries.length ? entries[entries.length - 1] : null;

  // Reset the scenario price whenever the latest entry changes.
  const latestId = latest?.id ?? null;
  useEffect(() => {
    setScenarioPrice(null);
  }, [latestId]);

  function commitGuestEntries(next: GuestCompEntry[]) {
    const sorted = sortByDate(next);
    guestEntries.current = sorted;
    writeGuestComp(sorted);
    setEntries(sorted.map(toCompEntry));
  }

  /** Save a new entry where this page keeps them; null on success, else the message to show. */
  async function saveEntry(input: CompEntryInput): Promise<string | null> {
    if (isGuest) {
      commitGuestEntries([...guestEntries.current, { id: newGuestId(), ...input }]);
      if (input.ticker) loadGuestQuotes([input.ticker]);
      return null;
    }
    const res = await fetch("/api/careerotter/comp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      await load();
      return null;
    }
    const data = await res.json().catch(() => null);
    return data?.error || "Could not save that.";
  }

  async function deleteEntry(id: string): Promise<boolean> {
    setError("");
    if (isGuest) {
      commitGuestEntries(guestEntries.current.filter((entry) => entry.id !== id));
      return true;
    }
    try {
      const res = await fetch(`/api/careerotter/comp/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
        return true;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error || "Could not delete that entry.");
    } catch {
      setError("Could not delete that entry.");
    }
    return false;
  }

  // "Today" for the vested/unvested split, fixed for the life of the page so
  // re-renders don't nudge fractions between keystrokes.
  const [now] = useState(() => new Date());
  const currentYear = now.getFullYear();
  const quote = latest?.ticker ? prices[latest.ticker] ?? null : null;
  const anchorPrice = latest ? anchorSharePrice(latest, quote) : null;
  const sharePrice = scenarioPrice ?? anchorPrice;
  const isScenario = scenarioPrice !== null && scenarioPrice !== anchorPrice;

  const projection = latest
    ? projectComp(latest, {
        sharePrice,
        years: projectionYears(latest, currentYear),
        asOf: now,
      })
    : null;
  const breakdown = latest ? annualBreakdown(latest, sharePrice) : null;
  const annualAtAnchor = latest ? annualizedTotal(latest, anchorPrice) : 0;
  const vest = latest ? vestSummary(latest, sharePrice, now) : null;
  const shareBased = latest ? hasShares(latest) : false;

  if (!loaded) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your comp">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const errorBanner = error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;

  if (!latest) {
    return (
      <div className="space-y-6">
        {errorBanner}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Start with what you make today</h2>
              <p className="text-sm text-muted-foreground">
                Base, bonus and equity from your current offer or last raise. You get a three-year
                projection, a live value on any public stock, and a place on the market range for
                your role.
              </p>
              {isGuest && (
                <p className="text-sm text-muted-foreground">
                  No account needed. What you enter stays in this browser for 24 hours; sign up
                  any time and it is saved for you.
                </p>
              )}
            </div>
            <CompEntryForm onSubmit={saveEntry} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <MarketComparison
              roleTitle={roleTitle}
              level={level}
              onRoleTitleChange={setRoleTitle}
              onLevelChange={setLevel}
              marketRange={marketRange}
              isPro={isPro}
              annualTotal={null}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start">
      {errorBanner && <div className="lg:col-span-2">{errorBanner}</div>}
      {/* Main column. On phones the wrappers dissolve and `order` interleaves the cards. */}
      <div className="contents lg:block lg:space-y-6">
        <Card className="order-1 lg:order-none">
          <CardContent className="space-y-5 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Annual total comp</p>
              <p className="text-4xl font-semibold text-foreground">
                {formatUsd(breakdown?.total ?? 0)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                Base {formatCompactUsd(breakdown?.salary ?? 0)}
                {(breakdown?.incentives ?? 0) > 0 && ` · Bonus ${formatCompactUsd(breakdown?.incentives ?? 0)}`}
                {(breakdown?.equityPerYear ?? 0) > 0 &&
                  ` · Equity ${formatCompactUsd(breakdown?.equityPerYear ?? 0)}/yr`}
                {vest && ` over a ${Number(latest.vest_years)}-year vest`}
                {isScenario && " at the simulated price"}
              </p>
            </div>
            <MarketComparison
              roleTitle={roleTitle}
              level={level}
              onRoleTitleChange={setRoleTitle}
              onLevelChange={setLevel}
              marketRange={marketRange}
              isPro={isPro}
              annualTotal={breakdown?.total ?? null}
            />
          </CardContent>
        </Card>

        {projection && (
          <Card className="order-2 lg:order-none">
            <CardContent className="space-y-5 p-5">
              <SectionHeading
                title="Projected comp"
                hint={
                  projection.hasVestSchedule
                    ? `Stock is what actually vests each year on your ${Number(latest.vest_years)}-year schedule${latest.vest_cliff_months ? ` with a ${latest.vest_cliff_months}-month cliff` : ""}${shareBased ? ", at the simulator's price" : ""}.`
                    : shareBased
                      ? "Stock is your shares at the simulator's price, carried flat. Add a vest schedule to the entry to see how it actually pays out."
                      : "Base, bonus and equity carried flat. Add a vest schedule to the entry to see how the grant pays out year by year."
                }
              />
              <ProjectionChart
                years={projection.years}
                hasVestSchedule={projection.hasVestSchedule}
                currentYear={currentYear}
              />
              <ProjectionTable
                years={projection.years}
                hasVestSchedule={projection.hasVestSchedule}
                taxRate={taxRate}
                onTaxRateChange={setTaxRate}
              />
            </CardContent>
          </Card>
        )}

        <Card className="order-7 lg:order-none">
          <CardContent className="space-y-2 p-5">
            <SectionHeading
              title="Your trajectory"
              hint={
                isGuest
                  ? "Every entry you have logged in this browser. The newest drives the page."
                  : "Every offer, raise and refresh you have logged. The newest drives the page."
              }
            />
            <HistoryList entries={entries} prices={prices} onDelete={deleteEntry} />
          </CardContent>
        </Card>
      </div>

      {/* Side column: the stock behind the numbers, the what-if, and the next entry. */}
      <div className="contents lg:block lg:space-y-6">
        {isGuest && (
          <div className="order-3 lg:order-none">
            <GuestSavePrompt entryCount={entries.length} />
          </div>
        )}

        {shareBased && latest.ticker && (
          <div className="order-4 lg:order-none">
            <CompanyCard
              ticker={latest.ticker}
              quote={quote}
              priceFeedEnabled={priceFeedEnabled}
              shares={Number(latest.shares)}
              sharePrice={sharePrice}
              isScenario={isScenario}
              vest={vest}
            />
          </div>
        )}

        {shareBased && (
          <div className="order-5 lg:order-none">
            <PriceSimulator
              ticker={latest.ticker}
              shares={Number(latest.shares)}
              anchorPrice={anchorPrice}
              price={sharePrice}
              onPriceChange={setScenarioPrice}
              totalAtPrice={breakdown?.total ?? 0}
              totalAtAnchor={annualAtAnchor}
            />
          </div>
        )}

        <Card className="order-6 lg:order-none">
          <CardContent className="space-y-4 p-5">
            <SectionHeading
              title="Log a change"
              hint="A new offer, a raise, a refresh grant. It becomes the current entry."
            />
            <CompEntryForm onSubmit={saveEntry} suggestedTicker={latest.ticker} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
