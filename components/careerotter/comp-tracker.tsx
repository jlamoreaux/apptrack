"use client";

import { useCallback, useEffect, useState } from "react";
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
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const total = (e: CompEntry) => Number(e.base) + Number(e.bonus) + Number(e.equity);

export function CompTracker() {
  const [entries, setEntries] = useState<CompEntry[]>([]);
  const [marketRange, setMarketRange] = useState<MarketRange | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [roleFamily, setRoleFamily] = useState("");
  const [level, setLevel] = useState("");
  const [form, setForm] = useState({ effective_date: "", base: "", bonus: "", equity: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (roleFamily) qs.set("roleFamily", roleFamily);
    if (level) qs.set("level", level);
    const res = await fetch(`/api/careerotter/comp?${qs.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setMarketRange(data.marketRange);
      setIsPro(data.isPro);
    }
  }, [roleFamily, level]);

  useEffect(() => {
    load();
  }, [load]);

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
        }),
      });
      if (res.ok) {
        setForm({ effective_date: "", base: "", bonus: "", equity: "" });
        await load();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not save that.");
      }
    } finally {
      setSaving(false);
    }
  }

  const latest = entries.length ? entries[entries.length - 1] : null;
  const latestTotal = latest ? total(latest) : 0;
  const delta = marketRange && latest ? compDelta(latestTotal, marketRange) : null;

  return (
    <div className="space-y-6">
      {/* Market comparison */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleFamily} onValueChange={setRoleFamily}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {COMP_ROLE_FAMILIES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          ) : roleFamily && level ? (
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
        </div>
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
              <li key={e.id} className="flex items-center justify-between border-b py-2 text-sm">
                <span className="text-muted-foreground">{e.effective_date}</span>
                <span className="tabular-nums font-medium">{usd(total(e))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
