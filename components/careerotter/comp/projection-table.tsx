"use client";

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

const color = (key: (typeof COMP_SERIES)[number]["key"]) =>
  COMP_SERIES.find((s) => s.key === key)?.color;

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
    <td className={`py-2 pl-3 text-right tabular-nums ${className}`}>
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
  const headClass = "py-2 pr-3 text-left font-normal text-muted-foreground";
  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-left font-normal">
                <span className="sr-only">Component</span>
              </th>
              {years.map((y) => (
                <th key={y.year} scope="col" className="py-2 pl-3 text-right font-medium tabular-nums">
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
                  <th scope="row" className="py-1 pl-[18px] pr-3 text-left font-normal">
                    Vested
                  </th>
                  {years.map((y) => (
                    <td key={y.year} className="py-1 pl-3 text-right tabular-nums">
                      {y.stockVested > 0 ? (
                        <span title={formatUsd(y.stockVested)}>{formatCompactUsd(y.stockVested)}</span>
                      ) : (
                        <span aria-label="none">–</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="text-xs text-muted-foreground">
                  <th scope="row" className="py-1 pl-[18px] pr-3 text-left font-normal">
                    Unvested
                  </th>
                  {years.map((y) => (
                    <td key={y.year} className="py-1 pl-3 text-right tabular-nums">
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
              <th scope="row" className="py-2 pr-3 text-left font-semibold text-foreground">
                Total comp
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.total} className="font-semibold text-foreground" />
              ))}
            </tr>
            <tr className="text-muted-foreground">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                Est. take-home
              </th>
              {years.map((y) => (
                <Cell key={y.year} value={y.total * (1 - taxRate / 100)} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

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
          className="h-9 min-h-9 w-16 text-center text-sm"
          aria-describedby="tax-rate-hint"
        />
        <span id="tax-rate-hint">%. Set it to match your own rate.</span>
      </div>
    </div>
  );
}
