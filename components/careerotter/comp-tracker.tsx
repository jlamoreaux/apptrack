"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMP_ROLE_FAMILIES,
  COMP_LEVELS,
  compDelta,
  type MarketRange,
} from "@/lib/careerotter/market-data";

interface CompEntry {
  id: string;
  effective_date: string;
  base: number;
  bonus: number;
  equity: number;
  currency: string;
  note: string | null;
  ticker: string | null;
  shares: number | null;
  vest_start: string | null;
  vest_years: number | null;
}

/**
 * Fraction of calendar year `year` that falls inside the vesting window
 * [start, start + vestYears). 1 for fully-vesting years, prorated at the
 * edges, 0 outside the window.
 */
export function vestedFractionOfYear(year: number, start: Date, vestYears: number): number {
  const windowStart = start.getTime();
  const windowEnd = new Date(start);
  windowEnd.setMonth(windowEnd.getMonth() + Math.round(vestYears * 12));
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();
  const overlap =
    Math.min(yearEnd, windowEnd.getTime()) - Math.max(yearStart, windowStart);
  return Math.max(0, Math.min(1, overlap / (yearEnd - yearStart)));
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const total = (e: CompEntry) => Number(e.base) + Number(e.bonus) + Number(e.equity);

// Map a free-text job title to a known benchmark role family when it clearly
// matches one, so the market comparison still works for common titles. Any other
// title is passed through unchanged and simply shows the user's own history.
function resolveRoleFamily(title: string): string {
  const t = title.trim().toLowerCase();
  if (!t) return "";
  const match = COMP_ROLE_FAMILIES.find((r) => {
    const label = r.label.toLowerCase();
    // Exact match always wins; substring matching only for meaningful lengths so
    // a single letter like "d" can't resolve to the first family that contains it.
    return t === label || t === r.value || (t.length >= 3 && (t.includes(label) || label.includes(t)));
  });
  return match ? match.value : title.trim();
}

export function CompTracker() {
  const [entries, setEntries] = useState<CompEntry[]>([]);
  const [marketRange, setMarketRange] = useState<MarketRange | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [prices, setPrices] = useState<
    Record<string, { price: number; as_of: string }>
  >({});
  const [roleTitle, setRoleTitle] = useState("");
  const [level, setLevel] = useState("");
  const [form, setForm] = useState({
    effective_date: "",
    base: "",
    bonus: "",
    equity: "",
    ticker: "",
    shares: "",
    vest_start: "",
    vest_years: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scenarioPrice, setScenarioPrice] = useState<number | null>(null);
  // Effective tax rate for the take-home row. An estimate the user controls —
  // no jurisdiction math, no pretending to know their tax situation.
  const [taxRate, setTaxRate] = useState(30);
  // Two-step delete: first click arms confirmId, second confirms. Avoids a modal
  // dependency while still guarding against an accidental permanent delete.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const roleFamily = resolveRoleFamily(roleTitle);
    const qs = new URLSearchParams();
    if (roleFamily) qs.set("roleFamily", roleFamily);
    if (level) qs.set("level", level);
    try {
      const res = await fetch(`/api/careerotter/comp?${qs.toString()}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setMarketRange(data.marketRange);
        setIsPro(data.isPro);
        setPrices(data.prices ?? {});
      }
    } catch (err) {
      // A superseded or unmounted lookup aborts; ignore it. Other network errors
      // leave the prior state in place — the next successful load recovers.
      if ((err as Error)?.name !== "AbortError") return;
    }
  }, [roleTitle, level]);

  // Debounce the free-text role lookup and abort the in-flight request, so a slow
  // older response can't overwrite a newer one (roleTitle changes per keystroke).
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => load(controller.signal), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  // Reset the scenario price back to the anchor whenever the latest entry changes.
  const latestId = entries.length ? entries[entries.length - 1].id : null;
  useEffect(() => {
    setScenarioPrice(null);
  }, [latestId]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const base = Number(form.base);
    if (!form.effective_date || !Number.isFinite(base) || base <= 0) {
      setError("Enter an effective date and a base salary.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/careerotter/comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_date: form.effective_date,
          base,
          bonus: Number(form.bonus) || 0,
          equity: Number(form.equity) || 0,
          ticker: form.ticker.trim() || null,
          shares: Number(form.shares) || null,
          vest_start: form.vest_start || null,
          vest_years: Number(form.vest_years) || null,
        }),
      });
      if (res.ok) {
        setForm({
          effective_date: "",
          base: "",
          bonus: "",
          equity: "",
          ticker: "",
          shares: "",
          vest_start: "",
          vest_years: "",
        });
        await load();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not save that.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    // One delete at a time: the controls are disabled while a delete is in flight,
    // but guard here too so a stray call can't start an overlapping request that
    // would 404 once the row is already gone.
    if (deletingId) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/careerotter/comp/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not delete that entry.");
      }
    } catch {
      setError("Could not delete that entry.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  const latest = entries.length ? entries[entries.length - 1] : null;
  const latestTotal = latest ? total(latest) : 0;
  const delta = marketRange && latest ? compDelta(latestTotal, marketRange) : null;

  // Equity scenario: model total comp as base + bonus + shares * price.
  const latestShares = latest?.shares ? Number(latest.shares) : 0;
  const hasShares = latestShares > 0;
  const latestEquity = latest ? Number(latest.equity) : 0;
  // Prefer the live cached market price for the latest entry's ticker as the
  // slider anchor; fall back to the implied per-share price the recorded equity
  // reflects, else $100.
  const livePrice =
    latest?.ticker && prices[latest.ticker] ? prices[latest.ticker] : null;
  const anchorPrice = livePrice
    ? livePrice.price
    : hasShares && latestEquity > 0
      ? latestEquity / latestShares
      : 100;
  const scenarioMax = Math.max(anchorPrice * 3, 1);
  const price = scenarioPrice ?? anchorPrice;
  const scenarioTotal = latest
    ? Number(latest.base) + Number(latest.bonus) + latestShares * price
    : 0;
  const scenarioDelta = scenarioTotal - latestTotal;

  // Multi-year projection. Salary and incentives are carried flat; stock is
  // valued at the scenario price and prorated across the vesting window when a
  // vest length is recorded (window starts at vest_start, else the entry date).
  // Without a vest length the stock/equity number is carried flat, matching the
  // single-year scenario semantics above.
  const nowYear = new Date().getFullYear();
  const projectionYears = [nowYear, nowYear + 1, nowYear + 2];
  const vestYears = latest?.vest_years ? Number(latest.vest_years) : null;
  const vestStartDate = latest
    ? new Date(`${latest.vest_start ?? latest.effective_date}T00:00:00`)
    : null;
  const stockForYear = (year: number): number => {
    if (!latest) return 0;
    if (hasShares) {
      const grantValue = latestShares * price;
      if (vestYears && vestStartDate) {
        return (grantValue / vestYears) * vestedFractionOfYear(year, vestStartDate, vestYears);
      }
      return grantValue;
    }
    if (vestYears && vestStartDate) {
      return latestEquity * vestedFractionOfYear(year, vestStartDate, vestYears);
    }
    return latestEquity;
  };
  const projection = latest
    ? projectionYears.map((year) => {
        const stock = stockForYear(year);
        return {
          year,
          salary: Number(latest.base),
          incentives: Number(latest.bonus),
          stock,
          total: Number(latest.base) + Number(latest.bonus) + stock,
        };
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Market comparison */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="comp-role">Role</Label>
              <Input
                id="comp-role"
                list="comp-role-suggestions"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Staff Software Engineer"
                className="min-h-[44px]"
                autoComplete="off"
              />
              <datalist id="comp-role-suggestions">
                {COMP_ROLE_FAMILIES.map((r) => (
                  <option key={r.value} value={r.label} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {COMP_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {latest && (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums">{usd(latestTotal)}</span>
              {delta && (
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {delta.pct > 0 ? "+" : ""}
                  {delta.pct}% vs market
                </span>
              )}
            </div>
          )}

          {marketRange ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">you</span>
                <Progress
                  value={Math.min(100, (latestTotal / marketRange.high) * 100)}
                  className="h-2 flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">market</span>
                <Progress
                  value={Math.min(100, (marketRange.mid / marketRange.high) * 100)}
                  className="h-2 flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Market data from {marketRange.source}. Range {usd(marketRange.low)}–{usd(marketRange.high)}.
              </p>
            </div>
          ) : !isPro ? (
            <p className="text-sm text-muted-foreground">
              The market benchmark is a Pro feature. Your own history is tracked below.
            </p>
          ) : roleTitle.trim().length > 0 && level ? (
            <p className="text-sm text-muted-foreground">
              No market data for that role and level yet. Showing your own history only.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a role and level to compare against the market.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Equity scenario */}
      {latest && hasShares ? (
        <Card className="border-border bg-card">
          <CardContent className="space-y-4 p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Equity scenario</h3>
              <p className="text-xs text-muted-foreground">
                Drag to see how {latest.ticker ? `${latest.ticker}'s` : "the"} share price
                moves your total comp. {latestShares.toLocaleString()} shares.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scenario-price">Price per share</Label>
                <Input
                  id="scenario-price"
                  type="number"
                  min="0"
                  step="any"
                  value={Number.isFinite(price) ? Math.round(price * 100) / 100 : ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setScenarioPrice(Number.isFinite(v) && v >= 0 ? v : 0);
                  }}
                  className="min-h-[44px] w-32"
                />
                {livePrice && (
                  <p className="text-xs text-muted-foreground">
                    {latest.ticker} as of{" "}
                    {new Date(livePrice.as_of).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={scenarioMax}
              step={scenarioMax / 100}
              value={Math.min(price, scenarioMax)}
              onChange={(e) => setScenarioPrice(Number(e.target.value))}
              aria-label="Stock price scenario"
              className="min-h-11 w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usd(0)}</span>
              <span>{usd(scenarioMax)}</span>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-foreground">
                At{" "}
                <span className="font-semibold text-primary tabular-nums">
                  {usd(price)}
                </span>
                /share, your total comp is{" "}
                <span className="text-xl font-bold text-primary tabular-nums">
                  {usd(scenarioTotal)}
                </span>
                .
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {scenarioDelta >= 0 ? "+" : ""}
                {usd(scenarioDelta)} vs your recorded total of {usd(latestTotal)}.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : latest ? (
        <p className="text-sm text-muted-foreground">
          Add a ticker and share count to model how price changes move your comp.
        </p>
      ) : null}

      {/* Multi-year projection */}
      {latest && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Projected comp</h3>
              <p className="text-xs text-muted-foreground">
                {vestYears
                  ? `Stock prorated over a ${vestYears}-year vest${hasShares ? " at the scenario price above" : ""}.`
                  : "Add a vest length to an entry to prorate stock across years."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1 pr-4 font-normal" />
                    {projection.map((p) => (
                      <th key={p.year} scope="col" className="py-1 pr-4 font-medium tabular-nums">
                        {p.year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="py-1 pr-4 text-left font-normal text-muted-foreground">
                      Salary
                    </th>
                    {projection.map((p) => (
                      <td key={p.year} className="py-1 pr-4 tabular-nums">{usd(p.salary)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="py-1 pr-4 text-left font-normal text-muted-foreground">
                      Incentives
                    </th>
                    {projection.map((p) => (
                      <td key={p.year} className="py-1 pr-4 tabular-nums">{usd(p.incentives)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="py-1 pr-4 text-left font-normal text-muted-foreground">
                      Stock
                    </th>
                    {projection.map((p) => (
                      <td key={p.year} className="py-1 pr-4 tabular-nums">{usd(p.stock)}</td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <th scope="row" className="py-1.5 pr-4 text-left font-medium">
                      Total
                    </th>
                    {projection.map((p) => (
                      <td key={p.year} className="py-1.5 pr-4 font-semibold tabular-nums">
                        {usd(p.total)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="py-1 pr-4 text-left font-normal text-muted-foreground">
                      Est. take-home
                    </th>
                    {projection.map((p) => (
                      <td key={p.year} className="py-1 pr-4 tabular-nums text-muted-foreground">
                        {usd(p.total * (1 - taxRate / 100))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="tax-rate" className="text-xs text-muted-foreground">
                Effective tax rate
              </Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="60"
                step="1"
                value={taxRate}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setTaxRate(Math.min(60, Math.max(0, v)));
                }}
                className="min-h-[44px] w-20"
              />
              <span className="text-xs text-muted-foreground">
                % — rough estimate, set it to match your actual rate
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry form */}
      <form onSubmit={addEntry} className="space-y-3">
        <h3 className="text-sm font-semibold">Add a comp entry</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="eff">Date</Label>
            <Input id="eff" type="date" value={form.effective_date}
              onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="base">Base</Label>
            <Input id="base" type="number" min="0" value={form.base}
              onChange={(e) => setForm({ ...form, base: e.target.value })}
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bonus">Bonus</Label>
            <Input id="bonus" type="number" min="0" value={form.bonus}
              onChange={(e) => setForm({ ...form, bonus: e.target.value })}
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equity">Equity</Label>
            <Input id="equity" type="number" min="0" value={form.equity}
              onChange={(e) => setForm({ ...form, equity: e.target.value })}
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticker">Ticker (optional)</Label>
            <Input id="ticker" type="text" maxLength={10} value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
              placeholder="e.g. AAPL"
              autoComplete="off"
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shares">Shares (optional)</Label>
            <Input id="shares" type="number" min="0" step="any" value={form.shares}
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vest-start">Vest start (optional)</Label>
            <Input id="vest-start" type="date" value={form.vest_start}
              onChange={(e) => setForm({ ...form, vest_start: e.target.value })}
              className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vest-years">Vest years (optional)</Label>
            <Input id="vest-years" type="number" min="0" max="10" step="0.5" value={form.vest_years}
              onChange={(e) => setForm({ ...form, vest_years: e.target.value })}
              placeholder="e.g. 4"
              className="min-h-[44px]" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a ticker and share count to model equity by stock price, or leave Equity as a flat amount.
          Add a vest start and length to project stock across years.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} className="min-h-[44px]">
          {saving ? "Saving…" : "Add entry"}
        </Button>
      </form>

      {/* History */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Your trajectory</h3>
          <ul className="space-y-1">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm">
                <span className="text-muted-foreground">{e.effective_date}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{usd(total(e))}</span>
                  {confirmId === e.id ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => deleteEntry(e.id)}
                        disabled={deletingId !== null}
                        aria-label={`Confirm delete comp entry from ${e.effective_date}`}
                        className="h-11 px-3 text-destructive hover:text-destructive"
                      >
                        {deletingId === e.id ? "Deleting…" : "Delete"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId !== null}
                        aria-label="Cancel delete"
                        className="h-11 px-3 text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(e.id)}
                      disabled={deletingId !== null}
                      aria-label={`Delete comp entry from ${e.effective_date}`}
                      className="h-11 w-11 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
