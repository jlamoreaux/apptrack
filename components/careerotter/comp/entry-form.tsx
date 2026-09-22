"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateAsLocal } from "@/lib/utils/date";
import type { CompEntryInput } from "@/types";
import { validateCompEntryInput } from "@/lib/careerotter/comp-entry-validation";

interface CompEntryFormProps {
  /**
   * Saves the entry wherever the page keeps entries (the API, or the browser
   * for a guest). Resolves null on success or an error message to show.
   */
  onSubmit: (input: CompEntryInput) => Promise<string | null>;
  /** Ticker of the latest entry, offered as the default for the next one. */
  suggestedTicker?: string | null;
}

interface FormState {
  effective_date: string;
  base: string;
  bonus: string;
  equity: string;
  ticker: string;
  shares: string;
  vest_start: string;
  vest_years: string;
  vest_cliff_months: string;
}

const DEFAULT_VEST_YEARS = "4";
const DEFAULT_CLIFF_MONTHS = "12";

/** A blank form dated today. */
function emptyForm(): FormState {
  return {
    effective_date: formatDateAsLocal(new Date()),
    base: "",
    bonus: "",
    equity: "",
    ticker: "",
    shares: "",
    vest_start: "",
    vest_years: "",
    vest_cliff_months: "",
  };
}

/** Parse a typed amount, tolerating commas, dollar signs and spaces. NaN when not a number. */
const money = (v: string): number => {
  const n = Number(v.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * One entry, three fields to start. Equity as shares and a vesting schedule
 * are disclosures, opened only when they apply, so the common case is a
 * date, a base and a bonus. Opening the vest disclosure pre-fills the
 * industry default (4 years, 12-month cliff), which stays editable.
 */
export function CompEntryForm({ onSubmit, suggestedTicker }: CompEntryFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [asShares, setAsShares] = useState(false);
  const [vests, setVests] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  /** Open the shares disclosure, defaulting the ticker to the latest entry's. */
  function toggleShares(on: boolean) {
    setAsShares(on);
    if (on && !form.ticker && suggestedTicker) set({ ticker: suggestedTicker });
  }

  /** Open the vesting disclosure, pre-filling the standard schedule if empty. */
  function toggleVests(on: boolean) {
    setVests(on);
    if (on) {
      set({
        vest_start: form.vest_start || form.effective_date,
        vest_years: form.vest_years || DEFAULT_VEST_YEARS,
        vest_cliff_months: form.vest_cliff_months || DEFAULT_CLIFF_MONTHS,
      });
    }
  }

  /** Validate client-side, hand the entry to the parent, and reset on success. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const base = money(form.base);
    if (!form.effective_date) {
      setError("Enter the date this comp took effect.");
      return;
    }
    if (!Number.isFinite(base) || base <= 0) {
      setError("Enter your base salary.");
      return;
    }
    const shares = asShares ? money(form.shares) : NaN;
    if (asShares && !(shares > 0)) {
      setError("Enter how many shares the grant is for, or untick the stock option.");
      return;
    }
    // The same contract the API enforces, applied before anything is saved,
    // so a guest entry can never be accepted here and rejected on import.
    const checked = validateCompEntryInput({
      effective_date: form.effective_date,
      base,
      bonus: money(form.bonus) || 0,
      equity: money(form.equity) || 0,
      ticker: asShares ? form.ticker.trim().toUpperCase() || null : null,
      shares: asShares ? shares : null,
      vest_start: vests ? form.vest_start || null : null,
      // "" means not provided; a typed 0 must reach the validator so its
      // error surfaces instead of silently storing no vesting.
      vest_years: vests && form.vest_years !== "" ? Number(form.vest_years) : null,
      vest_cliff_months:
        vests && form.vest_cliff_months !== "" ? Number(form.vest_cliff_months) : null,
    });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setSaving(true);
    try {
      const message = await onSubmit(checked.value);
      if (message) {
        setError(message);
      } else {
        setForm(emptyForm());
        setAsShares(false);
        setVests(false);
      }
    } catch {
      setError("Could not save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const equityHint = asShares
    ? "Optional. The grant's value at award, used to estimate a share price until a live one is available."
    : vests
      ? "Total value of the grant. It is spread across the vest below."
      : "Per year. Tick the box below if it vests over several years.";

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="comp-form-hint">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="eff">Effective date</Label>
          <Input
            id="eff"
            type="date"
            value={form.effective_date}
            onChange={(e) =>
              set({
                effective_date: e.target.value,
                // Keep the vest start tracking the effective date until the user changes it.
                vest_start:
                  vests && (form.vest_start === form.effective_date || !form.vest_start)
                    ? e.target.value
                    : form.vest_start,
              })
            }
            required
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="base">Base salary</Label>
          <Input
            id="base"
            type="text"
            inputMode="decimal"
            value={form.base}
            onChange={(e) => set({ base: e.target.value })}
            placeholder="155,000"
            required
            className="min-h-[44px] tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bonus">Bonus and incentives</Label>
          <Input
            id="bonus"
            type="text"
            inputMode="decimal"
            value={form.bonus}
            onChange={(e) => set({ bonus: e.target.value })}
            placeholder="0"
            className="min-h-[44px] tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="equity">Equity</Label>
          <Input
            id="equity"
            type="text"
            inputMode="decimal"
            value={form.equity}
            onChange={(e) => set({ equity: e.target.value })}
            placeholder="0"
            aria-describedby="equity-hint"
            className="min-h-[44px] tabular-nums"
          />
          <p id="equity-hint" className="text-xs text-muted-foreground">
            {equityHint}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Checkbox
            id="as-shares"
            checked={asShares}
            onCheckedChange={(v) => toggleShares(v === true)}
          />
          <Label htmlFor="as-shares" className="cursor-pointer font-normal">
            It is stock in a public company
          </Label>
        </div>
        {asShares && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                type="text"
                maxLength={10}
                value={form.ticker}
                onChange={(e) => set({ ticker: e.target.value.toUpperCase() })}
                placeholder="NET"
                autoComplete="off"
                autoCapitalize="characters"
                className="min-h-[44px] uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                type="text"
                inputMode="decimal"
                value={form.shares}
                onChange={(e) => set({ shares: e.target.value })}
                placeholder="1,200"
                className="min-h-[44px] tabular-nums"
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              With a ticker, the live market price values your shares.
            </p>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Checkbox id="vests" checked={vests} onCheckedChange={(v) => toggleVests(v === true)} />
          <Label htmlFor="vests" className="cursor-pointer font-normal">
            It vests over time
          </Label>
        </div>
        {vests && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="vest-start">Vest start</Label>
              <Input
                id="vest-start"
                type="date"
                value={form.vest_start}
                onChange={(e) => set({ vest_start: e.target.value })}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vest-years">Vest years</Label>
              <Input
                id="vest-years"
                type="number"
                inputMode="decimal"
                min="0.5"
                max="10"
                step="0.5"
                value={form.vest_years}
                onChange={(e) => set({ vest_years: e.target.value })}
                className="min-h-[44px] tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vest-cliff">Cliff (months)</Label>
              <Input
                id="vest-cliff"
                type="number"
                inputMode="numeric"
                min="0"
                max="60"
                step="1"
                value={form.vest_cliff_months}
                onChange={(e) => set({ vest_cliff_months: e.target.value })}
                className="min-h-[44px] tabular-nums"
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Nothing vests before the cliff; the accrued amount vests on that day, then monthly to
              the end.
            </p>
          </div>
        )}
      </div>

      <p id="comp-form-hint" className="text-xs text-muted-foreground">
        Each entry is a point in time: a new offer, a raise, a refresh grant. The latest one drives
        the projection above.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving} className="min-h-[44px] w-full sm:w-auto">
        {saving ? "Saving…" : "Add entry"}
      </Button>
    </form>
  );
}
