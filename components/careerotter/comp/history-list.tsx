"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  anchorSharePrice,
  annualizedTotal,
  formatCompactUsd,
  formatSignedPct,
  formatSignedUsd,
  formatUsd,
  parseLocalDate,
  type CompEntry,
  type StockQuote,
} from "@/lib/careerotter/comp-projection";

interface HistoryListProps {
  /** Entries in ascending date order, as the API returns them. */
  entries: CompEntry[];
  /** Live quotes by ticker, so share-based entries are valued the way the headline is. */
  prices: Record<string, StockQuote>;
  onDelete: (id: string) => Promise<boolean>;
}

/** "Jan 15, 2026" from a YYYY-MM-DD entry date. */
const longDate = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/**
 * Every entry, newest first, with its breakdown and the step up (or down)
 * from the one before it. Totals are annual, valued like the headline.
 * Deleting is a two-step click, so an accidental tap cannot erase history.
 */
export function HistoryList({ entries, prices, onDelete }: HistoryListProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /** Run the confirmed delete; one at a time. */
  async function remove(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  /** Annual total comp for an entry, at its live price when there is one. */
  const annual = (entry: CompEntry) =>
    annualizedTotal(entry, anchorSharePrice(entry, entry.ticker ? prices[entry.ticker] ?? null : null));
  const rows = entries.map((entry, i) => {
    const total = annual(entry);
    const previous = i > 0 ? annual(entries[i - 1]) : null;
    const delta = previous !== null ? total - previous : null;
    const deltaPct = delta !== null && previous ? (delta / previous) * 100 : null;
    return { entry, total, delta, deltaPct, isLatest: i === entries.length - 1 };
  });

  return (
    <ol className="divide-y divide-border">
      {[...rows].reverse().map(({ entry, total, delta, deltaPct, isLatest }) => (
        <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm text-foreground">
              <span className="font-medium">{longDate(entry.effective_date)}</span>
              {isLatest && <span className="ml-2 text-xs text-muted-foreground">current</span>}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Base {formatCompactUsd(Number(entry.base))}
              {Number(entry.bonus) > 0 && ` · Bonus ${formatCompactUsd(Number(entry.bonus))}`}
              {Number(entry.equity) > 0 && ` · Equity ${formatCompactUsd(Number(entry.equity))}`}
              {Number(entry.shares) > 0 &&
                ` · ${Number(entry.shares).toLocaleString()} ${entry.ticker ?? ""} shares`.replace(
                  /\s+/g,
                  " "
                )}
              {entry.vest_years &&
                ` · ${Number(entry.vest_years)}-year vest${entry.vest_cliff_months ? `, ${entry.vest_cliff_months}-month cliff` : ""}`}
            </p>
            {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatUsd(total)}
                <span className="font-normal text-muted-foreground">/yr</span>
              </p>
              {delta !== null && deltaPct !== null && Math.abs(delta) >= 0.5 && (
                <p
                  className={`text-xs font-medium tabular-nums ${delta > 0 ? "text-secondary" : "text-destructive"}`}
                >
                  {formatSignedUsd(delta)} ({formatSignedPct(deltaPct, 0)})
                </p>
              )}
            </div>
            {confirmId === entry.id ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => remove(entry.id)}
                  disabled={deletingId !== null}
                  aria-label={`Confirm delete comp entry from ${entry.effective_date}`}
                  className="h-11 px-3 text-destructive hover:text-destructive"
                >
                  {deletingId === entry.id ? "Deleting…" : "Delete"}
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
                onClick={() => setConfirmId(entry.id)}
                disabled={deletingId !== null}
                aria-label={`Delete comp entry from ${entry.effective_date}`}
                className="h-11 w-11 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
