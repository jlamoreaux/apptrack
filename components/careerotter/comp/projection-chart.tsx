"use client";

import { useId, useState } from "react";
import {
  formatCompactUsd,
  formatUsd,
  niceTicks,
  type ProjectionYear,
} from "@/lib/careerotter/comp-projection";

/** Series in stack order, bottom to top. Colors come from globals.css tokens. */
export const COMP_SERIES = [
  { key: "salary", label: "Salary", color: "var(--comp-salary)" },
  { key: "stock", label: "Stock", color: "var(--comp-stock)" },
  { key: "incentives", label: "Incentives", color: "var(--comp-incentives)" },
] as const;

type SeriesKey = (typeof COMP_SERIES)[number]["key"];

/** Series top to bottom, the order a reader meets them on the stack. */
export const COMP_SERIES_TOP_DOWN = [...COMP_SERIES].reverse();

/**
 * Plot height in pixels. Every vertical position below is computed in pixels
 * from this rather than as a percentage: WebKit does not resolve percentage
 * heights inside a <button>, and on iOS Safari the columns collapsed to nothing.
 */
const PLOT_HEIGHT = 200;
/** Gap between stacked segments, in pixels. */
const SEGMENT_GAP = 2;

interface ProjectionChartProps {
  years: ProjectionYear[];
  hasVestSchedule: boolean;
  currentYear: number;
}

/**
 * Stacked columns, one per projected year, built from plain HTML so labels stay
 * crisp at every width. Each column is a button: hover or focus shows a readout
 * of every series for that year, so no value is reachable only by color.
 */
export function ProjectionChart({ years, hasVestSchedule, currentYear }: ProjectionChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const describedBy = useId();

  const maxTotal = Math.max(0, ...years.map((y) => y.total));
  const ticks = niceTicks(maxTotal);
  const top = ticks[ticks.length - 1] || 1;
  /** A value as a pixel height on the plot. */
  const px = (v: number) => (top > 0 ? (v / top) * PLOT_HEIGHT : 0);

  const activeYear = active !== null ? years.find((y) => y.year === active) ?? null : null;
  const activeIndex = activeYear ? years.indexOf(activeYear) : -1;

  return (
    <figure className="space-y-3" aria-describedby={describedBy}>
      <figcaption id={describedBy} className="sr-only">
        Projected total comp by year, stacked by salary, stock and incentives. The
        table below lists the same values.
      </figcaption>

      {/* Top padding leaves room for the cap labels and the top axis tick. It
          sits on a wrapper so the plot's own box stays exactly PLOT_HEIGHT. */}
      <div className="pt-5">
        <div className="relative flex select-none" style={{ height: PLOT_HEIGHT }}>
          {/* Y axis. Labels are anchored by `top`, so translating up half their
              height centers each one on its gridline. */}
          <div className="relative w-14 shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-2 -translate-y-1/2"
                style={{ top: PLOT_HEIGHT - px(t) }}
              >
                {formatCompactUsd(t)}
              </span>
            ))}
          </div>

          {/* Plot */}
          <div className="relative flex-1">
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden="true"
                className={t === 0 ? "absolute inset-x-0 border-t border-border" : "absolute inset-x-0 border-t border-border/50"}
                style={{ top: PLOT_HEIGHT - px(t) }}
              />
            ))}

            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
              {years.map((y) => {
                const segments = COMP_SERIES.map((s) => ({ ...s, value: y[s.key] })).filter(
                  (s) => s.value > 0
                );
                const isActive = active === y.year;
                return (
                  <button
                    key={y.year}
                    type="button"
                    className="group relative block w-full max-w-[64px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    style={{ height: PLOT_HEIGHT }}
                    onPointerEnter={() => setActive(y.year)}
                    onPointerLeave={() => setActive((cur) => (cur === y.year ? null : cur))}
                    onFocus={() => setActive(y.year)}
                    onBlur={() => setActive((cur) => (cur === y.year ? null : cur))}
                    aria-label={`${y.year}: total ${formatUsd(y.total)}. Salary ${formatUsd(y.salary)}, stock ${formatUsd(y.stock)}, incentives ${formatUsd(y.incentives)}.`}
                  >
                    {/* More than three columns on a phone puts neighbouring cap
                        labels on top of each other; the table and the tap
                        readout carry the values there instead. */}
                    <span
                      className={
                        "pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap pb-1 text-xs font-medium tabular-nums text-foreground" +
                        (years.length > 3 ? " hidden sm:block" : "")
                      }
                      style={{ bottom: px(y.total) }}
                      aria-hidden="true"
                    >
                      {formatCompactUsd(y.total)}
                    </span>
                    {/* Pinned to the column's floor and laid out top-down in plain
                        block flow, so the stack needs no flexbox inside the button. */}
                    <span className="absolute inset-x-0 bottom-0 block" aria-hidden="true">
                      {[...segments].reverse().map((s, i) => (
                        <span
                          key={s.key}
                          className={
                            "block w-full transition-[filter] " +
                            (i === 0 ? "rounded-t" : "") +
                            (isActive ? " brightness-110" : "")
                          }
                          style={{
                            height: Math.max(0, px(s.value) - (i > 0 ? SEGMENT_GAP : 0)),
                            marginTop: i > 0 ? SEGMENT_GAP : 0,
                            backgroundColor: s.color,
                          }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeYear && (
              <div
                role="status"
                className={
                  "pointer-events-none absolute top-1 z-10 min-w-[10rem] rounded-md border border-border bg-popover p-2 text-xs shadow-md " +
                  (activeIndex === 0
                    ? "left-0"
                    : activeIndex === years.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2")
                }
              >
                <p className="mb-1 font-medium text-foreground">{activeYear.year}</p>
                <dl className="space-y-0.5">
                  {COMP_SERIES_TOP_DOWN.map((s) => (
                    <div key={s.key}>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="inline-block h-0.5 w-3 rounded-full"
                            style={{ backgroundColor: s.color }}
                            aria-hidden="true"
                          />
                          {s.label}
                        </dt>
                        <dd className="font-semibold tabular-nums text-foreground">
                          {formatUsd(activeYear[s.key as SeriesKey])}
                        </dd>
                      </div>
                      {s.key === "stock" && hasVestSchedule && activeYear.stock > 0 && (
                        <div className="flex items-center justify-between gap-3 pl-[18px] text-muted-foreground">
                          <dt>of which unvested</dt>
                          <dd className="tabular-nums">{formatUsd(activeYear.stockUnvested)}</dd>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {formatUsd(activeYear.total)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* X axis */}
      <div className="flex pl-14">
        <div className="flex flex-1 justify-around gap-2 px-2 text-xs tabular-nums">
          {years.map((y) => (
            <span
              key={y.year}
              className={
                "w-full max-w-[64px] text-center " +
                (y.year === currentYear ? "font-semibold text-foreground" : "text-muted-foreground")
              }
            >
              {y.year}
            </span>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 pl-14 text-xs text-muted-foreground" aria-label="Legend">
        {COMP_SERIES_TOP_DOWN.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
