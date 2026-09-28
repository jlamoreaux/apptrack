/**
 * Bounds, defaults and fixed copy for the CareerOtter MCP comp tools
 * (lib/mcp/tools/comp-*.ts).
 */

import type { CompDelta } from "@/lib/careerotter/market-data";
import { COMP_LIMITS, VEST_YEARS_MIN_LABEL } from "@/lib/constants/careerotter";
import { ISO_DATE_FORMAT, MS_PER_DAY } from "@/lib/constants/dates";

// Every amount the comp tools read or write is annual USD.
export const MCP_COMP_CURRENCY = "USD";

/** project_comp and evaluate_offer: how many calendar years to project, starting with the as_of year. */
export const MCP_COMP_PROJECTION_YEARS = {
  min: 1,
  max: 10,
  default: 4,
} as const;

// A share price above this is almost certainly a typo (or a total grant value
// passed as a price), and bounding it keeps projected totals finite.
export const MCP_SHARE_PRICE_MAX = 1_000_000;

// Default labels for offer packages, by position; one per allowed package.
export const MCP_OFFER_PACKAGE_LABELS = ["Package A", "Package B"] as const;
export const MCP_OFFER_CURRENT_LABEL = "Current package";

export const MCP_EVALUATE_OFFER = {
  minPackages: 1,
  maxPackages: MCP_OFFER_PACKAGE_LABELS.length,
  maxScenariosPerPackage: 5,
  labelMax: 60,
} as const;

// Offer packages are projected in memory as comp entries; their ids only need
// to be distinct from each other and from stored uuids.
export const MCP_OFFER_ENTRY_ID_PREFIX = "offer-package-";

// The cache is refreshed daily; a quote older than this has missed at least
// one refresh (a weekend included), so agents should say how old it is.
export const MCP_QUOTE_STALE_AFTER_DAYS = 3;
export const MCP_QUOTE_STALE_AFTER_MS = MCP_QUOTE_STALE_AFTER_DAYS * MS_PER_DAY;

// What evaluate_offer deliberately leaves out of its totals, stated in every
// result so an agent does not present the numbers as complete.
export const MCP_OFFER_NOT_MODELED = ["refresher grants", "sign-on bonuses", "taxes"] as const;

/**
 * Where a projection's share price came from: passed in by the caller, the
 * cached quote for the entry's ticker, the price its recorded equity implies,
 * or none (no shares, or no price known).
 */
export const MCP_PRICE_SOURCES = ["given", "quote", "implied", "none"] as const;
export type McpPriceSource = (typeof MCP_PRICE_SOURCES)[number];

// The sources an entry's own anchor price can have; "given" needs a caller.
export const MCP_ANCHOR_PRICE_SOURCES = ["quote", "implied", "none"] as const;
export type McpAnchorPriceSource = (typeof MCP_ANCHOR_PRICE_SOURCES)[number];

// Mirrors CompDelta["direction"] in lib/careerotter/market-data.ts.
export const MCP_MARKET_DELTA_DIRECTIONS = ["under", "over", "at"] as const satisfies readonly CompDelta["direction"][];

export const MCP_COMP_MESSAGES = {
  benchmarkRequiresPro: "The market benchmark requires CareerOtter Pro.",
  noMarketData: "No curated market data for this role family and level.",
  entryNotFound: "Comp entry not found",
  noCurrentEntry: "No comp entry is in effect on as_of; pass entry_id or add an entry first.",
  sharePriceNeedsShares: "share_price applies only to entries with a share count.",
  scenariosNeedShares: "share_prices apply only to packages with a share count.",
  emptyPatch: "Provide at least one field to change.",
  duplicateLabel: "Each package needs a different label.",
  reservedLabel: `"${MCP_OFFER_CURRENT_LABEL}" is reserved for the user's current package.`,
} as const;

const DATE_NOTE = `(${ISO_DATE_FORMAT})`;

/** Field descriptions shared by add_comp_entry, update_comp_entry and evaluate_offer packages. */
export const MCP_COMP_FIELD_DESCRIPTIONS = {
  effective_date: `The date this package took or takes effect ${DATE_NOTE}.`,
  base: `Annual base salary, ${MCP_COMP_CURRENCY}.`,
  bonus: `Annual bonus, ${MCP_COMP_CURRENCY}.`,
  equity: `Total grant value when vest_years is set; annual equity when it is not. ${MCP_COMP_CURRENCY}.`,
  note: "Optional short note.",
  ticker: "Stock ticker for share-based equity, e.g. ACME.",
  shares: "Total shares in the grant.",
  vest_start: `Vesting start date ${DATE_NOTE}; defaults to effective_date in projections.`,
  vest_years: `Vest length in years, from ${COMP_LIMITS.vestYearsMin} (${VEST_YEARS_MIN_LABEL}) to ${COMP_LIMITS.vestYearsMax}.`,
  vest_cliff_months: "Cliff in whole months; requires vest_years.",
  offer_vest_start: `Vesting start date ${DATE_NOTE}. Defaults to as_of.`,
  offer_label: `A name for the package. Defaults to its position (${MCP_OFFER_PACKAGE_LABELS.join(", ")}).`,
} as const;

/** Description sentences the comp tools share. */
export const MCP_COMP_DESCRIPTION_NOTES = {
  amounts: `All amounts are annual ${MCP_COMP_CURRENCY}.`,
  equity:
    "Equity: when vest_years is set, equity is the total grant value vesting over those years; when vest_years is empty, equity is the annual equity amount.",
  utc: `Dates are evaluated in UTC (the comp page uses the browser's timezone, so results can differ by a day at date boundaries); pass as_of ${DATE_NOTE} to pin the date.`,
  writeCurrency: `Amounts must be annual ${MCP_COMP_CURRENCY}: convert, or ask the user, before writing an amount given in another currency.`,
  priceFreshness:
    `When price_source is quote, price_as_of is when the cached quote was taken and price_is_stale is true once it is more than ${MCP_QUOTE_STALE_AFTER_DAYS} days old; say how old the price is. Otherwise price_as_of is null and price_is_stale is false.`,
} as const;
