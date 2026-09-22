"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCompactUsd,
  formatPrice,
  formatSignedPct,
  formatSignedUsd,
  formatUsd,
  type StockQuote,
  type VestSummary,
} from "@/lib/careerotter/comp-projection";

interface CompanyCardProps {
  ticker: string;
  quote: StockQuote | null;
  priceFeedEnabled: boolean;
  shares: number;
  /** The price the page is currently valuing shares at (live or scenario). */
  sharePrice: number | null;
  /** True when the price shown is a what-if, not the live quote. */
  isScenario: boolean;
  vest: VestSummary | null;
}

/** Finnhub returns full legal exchange names; readers know the short ones. */
export function shortExchange(exchange: string | null): string | null {
  if (!exchange) return null;
  const upper = exchange.toUpperCase();
  if (upper.includes("NASDAQ")) return "NASDAQ";
  if (upper.includes("NEW YORK STOCK EXCHANGE")) return "NYSE";
  if (upper.includes("LONDON")) return "LSE";
  if (upper.includes("TORONTO")) return "TSX";
  return exchange.length > 12 ? exchange.slice(0, 12) : exchange;
}

const monthYear = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
const fullDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * The ticker behind the user's equity: live price and day's move, market cap,
 * and what their own shares are worth at that price, with where the grant
 * stands in its vest. Says plainly why there is no price when there isn't one.
 */
export function CompanyCard({
  ticker,
  quote,
  priceFeedEnabled,
  shares,
  sharePrice,
  isScenario,
  vest,
}: CompanyCardProps) {
  const name = quote?.company_name ?? ticker;
  const exchange = shortExchange(quote?.exchange ?? null);
  const change = quote?.change ?? null;
  const changePct = quote?.change_pct ?? null;
  const changeTone =
    change === null ? "text-muted-foreground" : change >= 0 ? "text-secondary" : "text-destructive";
  const holdingValue = sharePrice && sharePrice > 0 ? shares * sharePrice : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          {quote?.logo_url ? (
            // Third-party logo from the price feed; a plain img keeps the host list open.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quote.logo_url}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-md bg-surface-raised object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised text-sm font-semibold text-muted-foreground"
            >
              {ticker.slice(0, 2)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">{name}</h3>
            <a
              href={`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {exchange ? `${exchange}: ${ticker}` : ticker}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>

        {quote ? (
          <div>
            <p className="text-3xl font-semibold text-foreground">{formatPrice(quote.price)}</p>
            <p className={`text-sm font-medium tabular-nums ${changeTone}`}>
              {change !== null && changePct !== null
                ? `${formatSignedUsd(change, true)} (${formatSignedPct(changePct, 2)}) today`
                : "Latest close"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              As of {fullDate(new Date(quote.as_of))}. Prices refresh once a day.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {priceFeedEnabled
              ? `No price for ${ticker} yet. It arrives with the next daily refresh; set a price in the simulator to model it now.`
              : "Live prices are not enabled here. Set a price in the simulator to model your equity."}
          </p>
        )}

        {quote?.market_cap_musd !== null && quote?.market_cap_musd !== undefined && (
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Market cap</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {formatCompactUsd(quote.market_cap_musd * 1e6)}
              </dd>
            </div>
            {quote.previous_close !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Previous close</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {formatPrice(quote.previous_close)}
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="space-y-1 border-t border-border pt-3 text-sm">
          <p className="text-foreground">
            <span className="font-medium tabular-nums">{shares.toLocaleString()}</span> shares
            {holdingValue !== null ? (
              <>
                {" "}
                worth{" "}
                <span className="font-semibold tabular-nums" title={formatUsd(holdingValue)}>
                  {formatCompactUsd(holdingValue)}
                </span>
                {isScenario ? " at the simulated price" : " at today's price"}
              </>
            ) : (
              " with no price to value them at yet"
            )}
            .
          </p>
          {vest && holdingValue !== null && (
            <p className="text-xs text-muted-foreground">
              {vest.fullyVested
                ? `Fully vested as of ${monthYear(vest.fullyVestedDate)}.`
                : !vest.cliffPassed && vest.cliffDate
                  ? `Nothing vests until the cliff on ${fullDate(vest.cliffDate)}, when ${formatCompactUsd(vest.cliffValue)} vests at once. Fully vests ${monthYear(vest.fullyVestedDate)}.`
                  : `${Math.round(vest.vestedFraction * 100)}% vested (${formatCompactUsd(vest.vestedValue)}). ${formatCompactUsd(vest.unvestedValue)} still to vest through ${monthYear(vest.fullyVestedDate)}.`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
