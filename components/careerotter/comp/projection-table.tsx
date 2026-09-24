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

/** A muted sub-row under Stock; a dash where the value is zero. */
function SplitRow({ label, values }: { label: string; values: { year: number; value: number }[] }) {
  return (
    <tr className="text-xs text-muted-foreground">
      <th scope="row" className="sticky left-0 z-10 bg-card py-1 pl-[18px] pr-3 text-left font-normal">
        {label}
      </th>
      {values.map(({ year, value }) => (
        <td key={year} className="whitespace-nowrap py-1 pl-2 text-right tabular-nums sm:pl-3">
          {value > 0 ? (
            <span title={formatUsd(value)}>{formatCompactUsd(value)}</span>
          ) : (
            <span aria-label="none">–</span>
          )}
        </td>
      ))}
    </tr>
  );
}

/**
 * The chart's table twin: every projected number, by year, rows in the same
 * top-to-bottom order as the stacked columns. Take-home is a rough estimate
 * the user controls with one rate; no jurisdiction math.
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
  // Whether the table overflows at all: only then is the scroller a tab stop,
  // so keyboard users can reach the later years without an idle stop on
  // wide screens where every year already fits.
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    /** Re-measure whether any column sits past the right edge. */
    const update = () => {
      const overflow = el.scrollWidth - el.clientWidth;
      setScrollable(overflow > 1);
      setMoreRight(overflow - el.scrollLeft > 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    // The scroller's own box is pinned by the card, so a width change that
    // comes from new cell values (the slider, the tax rate) shows up only on
    // the table inside it; watch both.
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [years.length]);

  // The row-label column stays put while the years scroll under it.
  // The vested / still-to-vest split only says something once part of the
  // grant has vested; before the cliff it would repeat the Stock row as
  // "still to vest" beside a line of dashes.
  const showVestSplit = hasVestSchedule && years.some((y) => y.stockVested > 0);
  const headClass =
    "sticky left-0 z-10 bg-card py-2 pr-2 text-left font-normal text-muted-foreground sm:pr-3";
  return (
    <div className="space-y-3">
      {/* Three years fit a phone; five scroll inside the card rather than
          past its border. The table sits on its own compositing layer so iOS
          Safari repaints the cells cleanly as the slider changes them. */}
      <div className="relative">
        <div
          ref={scroller}
          role="region"
          aria-label="Projected compensation by year"
          tabIndex={scrollable ? 0 : undefined}
          className="overflow-x-auto rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
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
            {showVestSplit && (
              <>
                <SplitRow
                  label="Vested so far"
                  values={years.map((y) => ({ year: y.year, value: y.stockVested }))}
                />
                <SplitRow
                  label="Still to vest"
                  values={years.map((y) => ({ year: y.year, value: y.stockUnvested }))}
                />
              </>
            )}
            <tr>
              <th scope="row" className={headClass}>
                <Swatch seriesKey="salary" />
                Salary
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.salary} />
              ))}
            </tr>
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
      {scrollable && (
        <p className="text-xs text-muted-foreground">Swipe the table sideways for the later years.</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tax-rate">Tax rate for take-home</Label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="relative">
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
              className="min-h-[44px] w-24 pr-8 text-sm tabular-nums"
              aria-describedby="tax-rate-hint"
            />
            <span
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
              aria-hidden="true"
            >
              %
            </span>
          </div>
          <p id="tax-rate-hint" className="text-xs text-muted-foreground">
            Your effective rate. Drives the take-home row.
          </p>
        </div>
      </div>
    </div>
  );
}
