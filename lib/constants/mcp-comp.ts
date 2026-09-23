/**
 * Bounds, defaults and fixed copy for the CareerOtter MCP comp tools
 * (lib/mcp/tools/comp-*.ts).
 */

import type { CompDelta } from "@/lib/careerotter/market-data";

/** project_comp and evaluate_offer: how many calendar years to project, starting with the as_of year. */
export const MCP_COMP_PROJECTION_YEARS = {
  min: 1,
  max: 10,
  default: 4,
} as const;

// A share price above this is almost certainly a typo (or a total grant value
// passed as a price), and bounding it keeps projected totals finite.
export const MCP_SHARE_PRICE_MAX = 1_000_000;

export const MCP_EVALUATE_OFFER = {
  minPackages: 1,
  maxPackages: 2,
  maxScenariosPerPackage: 5,
  labelMax: 60,
} as const;

// Default labels for offer packages, by position.
export const MCP_OFFER_PACKAGE_LABELS = ["Package A", "Package B"] as const;
export const MCP_OFFER_CURRENT_LABEL = "Current package";

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
} as const;
