"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatPrice,
  formatSignedPct,
  formatSignedUsd,
  formatUsd,
} from "@/lib/careerotter/comp-projection";

interface PriceSimulatorProps {
  ticker: string | null;
  shares: number;
  /** The live or implied price the scenario resets to; null when unknown. */
  anchorPrice: number | null;
  /** The price currently in play (scenario, else anchor). */
  price: number | null;
  onPriceChange: (price: number | null) => void;
  /** Annual total comp at the current price and at the anchor price. */
  totalAtPrice: number;
  totalAtAnchor: number;
}

const QUICK_MOVES = [-50, -20, 20, 50, 100] as const;

/**
 * What-if on the share price. Quick moves are relative to the anchor (the live
 * price), not to each other, so +20% then +50% means +50%, the way a reader
 * expects. Reset returns to the anchor. Every projected number on the page
 * follows this price.
 */
export function PriceSimulator({
  ticker,
  shares,
  anchorPrice,
  price,
  onPriceChange,
  totalAtPrice,
  totalAtAnchor,
}: PriceSimulatorProps) {
  const current = price ?? 0;
  const sliderMax = Math.max((anchorPrice ?? current) * 3, 1);
  const delta = anchorPrice !== null && price !== null ? price - anchorPrice : null;
  const deltaPct = delta !== null && anchorPrice ? (delta / anchorPrice) * 100 : null;
  const deltaTone =
    delta === null || Math.abs(delta) < 0.005
      ? "text-muted-foreground"
      : delta > 0
        ? "text-secondary"
        : "text-destructive";
  const compDelta = totalAtPrice - totalAtAnchor;
  const isReset = anchorPrice !== null && (price === null || Math.abs(price - anchorPrice) < 0.005);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stock price simulator</h3>
          <p className="text-xs text-muted-foreground">
            {anchorPrice !== null
              ? `Move ${ticker ?? "the"} share price and every number on this page follows. ${shares.toLocaleString()} shares.`
              : `Enter a share price to value your ${shares.toLocaleString()} shares.`}
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-price">Price per share</Label>
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                aria-hidden="true"
              >
                $
              </span>
              <Input
                id="scenario-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price !== null ? Math.round(price * 100) / 100 : ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    onPriceChange(anchorPrice === null ? null : 0);
                    return;
                  }
                  const v = Number(e.target.value);
                  onPriceChange(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                className="min-h-[44px] w-36 pl-7 text-lg font-semibold tabular-nums"
              />
            </div>
          </div>
          {delta !== null && deltaPct !== null && (
            <p className={`text-right text-sm font-medium tabular-nums ${deltaTone}`} aria-live="polite">
              {Math.abs(delta) < 0.005 ? (
                <span className="text-xs">At the live price</span>
              ) : (
                <>
                  {formatSignedUsd(delta, true)}
                  <br />
                  <span className="text-xs">({formatSignedPct(deltaPct)}) vs live</span>
                </>
              )}
            </p>
          )}
        </div>

        <div>
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={sliderMax / 200}
            value={Math.min(current, sliderMax)}
            onChange={(e) => onPriceChange(Number(e.target.value))}
            aria-label="Share price scenario"
            aria-valuetext={formatPrice(current)}
            disabled={anchorPrice === null && price === null}
            className="min-h-11 w-full accent-primary"
          />
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>$0</span>
            {anchorPrice !== null && <span>live {formatPrice(anchorPrice)}</span>}
            <span>{formatPrice(sliderMax)}</span>
          </div>
        </div>

        {anchorPrice !== null && (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Quick price moves">
            {QUICK_MOVES.slice(0, 2).map((pct) => (
              <Button
                key={pct}
                type="button"
                variant="outline"
                onClick={() => onPriceChange(anchorPrice * (1 + pct / 100))}
                className="min-h-[44px] tabular-nums"
              >
                {pct}%
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => onPriceChange(null)}
              disabled={isReset}
              className="min-h-[44px]"
            >
              Reset
            </Button>
            {QUICK_MOVES.slice(2).map((pct) => (
              <Button
                key={pct}
                type="button"
                variant="outline"
                onClick={() => onPriceChange(anchorPrice * (1 + pct / 100))}
                className="min-h-[44px] tabular-nums"
              >
                +{pct}%
              </Button>
            ))}
          </div>
        )}

        <div className="rounded-md bg-surface-raised p-3 text-sm">
          <p className="text-muted-foreground">Annual total comp at this price</p>
          <p className="text-2xl font-semibold text-foreground">{formatUsd(totalAtPrice)}</p>
          {anchorPrice !== null && Math.abs(compDelta) >= 0.5 && (
            <p className={`text-xs font-medium tabular-nums ${compDelta > 0 ? "text-secondary" : "text-destructive"}`}>
              {formatSignedUsd(compDelta)} vs the live price
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
