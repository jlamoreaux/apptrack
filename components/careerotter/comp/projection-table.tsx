"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCompactUsd,
  formatUsd,
  type ProjectionYear,
} from "@/lib/careerotter/comp-projection";
import { COMP_SERIES } from "./projection-chart";

interface ProjectionTableProps {
  years: ProjectionYear[];
  hasVestSchedule: boolean;
  taxRate: number;
  onTaxRateChange: (rate: number) => void;
}

/** Series color token for a row's swatch. */
const color = (key: (typeof COMP_SERIES)[number]["key"]) =>
  COMP_SERIES.find((s) => s.key === key)?.color;

/** The small square that ties a table row to its chart series. */
function Swatch({ seriesKey }: { seriesKey: (typeof COMP_SERIES)[number]["key"] }) {
  return (
    <span
      className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-sm align-middle"
      style={{ backgroundColor: color(seriesKey) }}
      aria-hidden="true"
    />
  );
}

/** A compact value cell; the full figure is one hover or focus away. */
function Cell({ value, className = "" }: { value: number; className?: string }) {
  return (
    <td className={`whitespace-nowrap py-2 pl-2 text-right tabular-nums sm:pl-3 ${className}`}>
      <span title={formatUsd(value)}>{formatCompactUsd(value)}</span>
    </td>
  );
}

/**
 * The chart's table twin: every projected number, by year, with stock split
 * into what has vested and what is still to come. Take-home is a rough
 * estimate the user controls with one rate; no jurisdiction math.
 */
export function ProjectionTable({
  years,
  hasVestSchedule,
  taxRate,
  onTaxRateChange,
}: ProjectionTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  // Whether there are columns off to the right: drives the edge fade so a
  // phone reader can tell the later years are a swipe away, not missing.
  const [moreRight, setMoreRight] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    /** Re-measure whether any column sits past the right edge. */
    const update = () => setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [years.length]);

  // The row-label column stays put while the years scroll under it.
  const headClass =
    "sticky left-0 z-10 bg-card py-2 pr-2 text-left font-normal text-muted-foreground sm:pr-3";
  return (
    <div className="space-y-3">
      {/* Three years fit a phone; five scroll inside the card rather than
          past its border. The table sits on its own compositing layer so iOS
          Safari repaints the cells cleanly as the slider changes them. */}
      <div className="relative">
        <div ref={scroller} className="overflow-x-auto">
          <table className="w-full min-w-max transform-gpu text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-normal">
                <span className="sr-only">Component</span>
              </th>
              {years.map((y) => (
                <th key={y.year} scope="col" className="py-2 pl-2 text-right font-medium tabular-nums sm:pl-3">
                  {y.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={headClass}>
                <Swatch seriesKey="salary" />
                Salary
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.salary} />
              ))}
            </tr>
            <tr>
              <th scope="row" className={headClass}>
                <Swatch seriesKey="incentives" />
                Incentives
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.incentives} />
              ))}
            </tr>
            <tr>
              <th scope="row" className={headClass}>
                <Swatch seriesKey="stock" />
                Stock
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.stock} />
              ))}
            </tr>
            {hasVestSchedule && (
              <>
                <tr className="text-xs text-muted-foreground">
                  <th scope="row" className="sticky left-0 z-10 bg-card py-1 pl-[18px] pr-3 text-left font-normal">
                    Vested
                  </th>
                  {years.map((y) => (
                    <td key={y.year} className="whitespace-nowrap py-1 pl-2 text-right tabular-nums sm:pl-3">
                      {y.stockVested > 0 ? (
                        <span title={formatUsd(y.stockVested)}>{formatCompactUsd(y.stockVested)}</span>
                      ) : (
                        <span aria-label="none">–</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="text-xs text-muted-foreground">
                  <th scope="row" className="sticky left-0 z-10 bg-card py-1 pl-[18px] pr-3 text-left font-normal">
                    Unvested
                  </th>
                  {years.map((y) => (
                    <td key={y.year} className="whitespace-nowrap py-1 pl-2 text-right tabular-nums sm:pl-3">
                      {y.stockUnvested > 0 ? (
                        <span title={formatUsd(y.stockUnvested)}>{formatCompactUsd(y.stockUnvested)}</span>
                      ) : (
                        <span aria-label="none">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              </>
            )}
            <tr className="border-t border-border">
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-card py-2 pr-2 text-left font-semibold text-foreground sm:pr-3">
                Total comp
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.total} className="font-semibold text-foreground" />
              ))}
            </tr>
            <tr className="text-muted-foreground">
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-card py-2 pr-2 text-left font-normal sm:pr-3">
                Est. take-home
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.total * (1 - taxRate / 100)} />
              ))}
            </tr>
          </tbody>
        </table>
        </div>
        {moreRight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent"
          />
        )}
      </div>
      {years.length > 3 && (
        <p className="text-xs text-muted-foreground sm:hidden">
          {years.length} years; swipe the table sideways for the rest.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Label htmlFor="tax-rate" className="text-xs font-normal text-muted-foreground">
          Take-home assumes an effective tax rate of
        </Label>
        <Input
          id="tax-rate"
          type="number"
          inputMode="numeric"
          min="0"
          max="60"
          step="1"
          value={taxRate}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onTaxRateChange(Math.min(60, Math.max(0, v)));
          }}
          className="min-h-[44px] w-16 text-center text-sm"
          aria-describedby="tax-rate-hint"
        />
        <span id="tax-rate-hint">%. Set it to match your own rate.</span>
      </div>
    </div>
  );
}
