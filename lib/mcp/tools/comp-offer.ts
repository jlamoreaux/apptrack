/**
 * evaluate_offer: projects one or two hypothetical packages at several share
 * prices and compares each scenario with the user's current package (or with
 * the first package). Packages are validated like a new comp entry but only
 * ever built in memory; nothing is saved.
 */

import { z } from "zod";
import {
  hasShares,
  projectComp,
  type CompEntry,
  type StockQuote,
} from "@/lib/careerotter/comp-projection";
import {
  currentCompEntry,
  validateCompInput,
  type StoredCompEntry,
} from "@/lib/careerotter/comp-service";
import { invalid, ok } from "@/lib/careerotter/domain-result";
import {
  MCP_COMP_MESSAGES,
  MCP_EVALUATE_OFFER,
  MCP_OFFER_CURRENT_LABEL,
  MCP_OFFER_NOT_MODELED,
  MCP_OFFER_PACKAGE_LABELS,
  type McpPriceSource,
} from "@/lib/constants/mcp-comp";
import { defineTool, type DefinedTool } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import type { DomainResult } from "@/types";
import {
  COMP_DESCRIPTION_NOTES as NOTES,
  COMP_READ_ANNOTATIONS,
  anchorFor,
  asOfInput,
  finiteNumber,
  loadCachedQuotes,
  loadEntries,
  priceSourceOutput,
  projectionRowOutput,
  projectionYears,
  projectionYearsInput,
  resolveAsOf,
  sharePriceInput,
  sumTotals,
  toRowOutput,
  type ResolvedAsOf,
} from "./comp-shared";

const OFFER_CURRENCY = "USD";
const OFFER_ENTRY_ID_PREFIX = "offer-package-";

const amountInput = z.number().finite().nonnegative();

const packageInput = z.object({
  label: z.string().trim().min(1).max(MCP_EVALUATE_OFFER.labelMax).optional(),
  base: amountInput.describe("Annual base salary, USD."),
  bonus: amountInput.optional().describe("Annual bonus, USD."),
  equity: amountInput
    .optional()
    .describe("Total grant value when vest_years is set; annual equity when it is not. USD."),
  ticker: z.string().optional(),
  shares: z.number().finite().nonnegative().optional().describe("Total shares in the grant."),
  vest_start: z.string().optional().describe("YYYY-MM-DD. Defaults to as_of."),
  vest_years: z.number().finite().optional(),
  vest_cliff_months: z.number().int().optional(),
  share_prices: z
    .array(sharePriceInput)
    .max(MCP_EVALUATE_OFFER.maxScenariosPerPackage)
    .optional()
    .describe(
      `Up to ${MCP_EVALUATE_OFFER.maxScenariosPerPackage} share prices to evaluate a share-based package at. Without them the cached quote for ticker, else equity / shares, is used.`
    ),
});
type PackageInput = z.infer<typeof packageInput>;

const scenarioOutput = z.object({
  share_price: finiteNumber.nullable(),
  price_source: priceSourceOutput,
  rows: z.array(projectionRowOutput),
  total: finiteNumber,
});
type ScenarioOutput = z.infer<typeof scenarioOutput>;

const offerOutput = z.object({
  as_of: z.string(),
  years: z.array(z.number().int()),
  baseline: scenarioOutput.extend({
    kind: z.enum(["current", "package"]),
    label: z.string(),
    entry_id: z.string().nullable(),
  }),
  packages: z.array(
    z.object({
      label: z.string(),
      scenarios: z.array(scenarioOutput.extend({ delta: finiteNumber })),
    })
  ),
  not_modeled: z.array(z.string()),
});
type OfferOutput = z.infer<typeof offerOutput>;
type BaselineOutput = OfferOutput["baseline"];

interface OfferPackage {
  label: string;
  entry: CompEntry;
  sharePrices: readonly number[];
}

interface PricePoint {
  price: number | null;
  source: McpPriceSource;
}

interface Projector {
  years: number[];
  asOf: ResolvedAsOf;
  quotes: Readonly<Record<string, StockQuote>>;
}

// ── packages ───────────────────────────────────────────────────────────────

function toOfferPackage(
  input: PackageInput,
  index: number,
  asOf: ResolvedAsOf
): DomainResult<OfferPackage> {
  const label = input.label ?? MCP_OFFER_PACKAGE_LABELS[index] ?? `Package ${index + 1}`;
  const valid = validateCompInput({
    effective_date: asOf.date,
    base: input.base,
    bonus: input.bonus,
    equity: input.equity,
    ticker: input.ticker,
    shares: input.shares,
    vest_start: input.vest_start ?? asOf.date,
    vest_years: input.vest_years,
    vest_cliff_months: input.vest_cliff_months,
  });
  if (!valid.ok) return invalid(`${label}: ${valid.message}`);
  const entry: CompEntry = { ...valid.value, id: `${OFFER_ENTRY_ID_PREFIX}${index}`, currency: OFFER_CURRENCY };
  const sharePrices = input.share_prices ?? [];
  if (sharePrices.length > 0 && !hasShares(entry)) {
    return invalid(`${label}: ${MCP_COMP_MESSAGES.scenariosNeedShares}`);
  }
  return ok({ label, entry, sharePrices });
}

function toOfferPackages(
  inputs: readonly PackageInput[],
  asOf: ResolvedAsOf
): DomainResult<OfferPackage[]> {
  const packages: OfferPackage[] = [];
  for (const [index, input] of inputs.entries()) {
    const built = toOfferPackage(input, index, asOf);
    if (!built.ok) return built;
    packages.push(built.value);
  }
  return ok(packages);
}

// ── projection ─────────────────────────────────────────────────────────────

function pricePoints(pkg: OfferPackage, projector: Projector): PricePoint[] {
  if (pkg.sharePrices.length === 0) return [anchorFor(pkg.entry, projector.quotes)];
  return pkg.sharePrices.map((price) => ({ price, source: "given" }));
}

function projectScenario(entry: CompEntry, point: PricePoint, projector: Projector): ScenarioOutput {
  const projection = projectComp(entry, {
    sharePrice: point.price,
    years: projector.years,
    asOf: projector.asOf.instant,
  });
  return {
    share_price: point.price,
    price_source: point.source,
    rows: projection.years.map(toRowOutput),
    total: sumTotals(projection.years),
  };
}

function currentBaseline(current: StoredCompEntry, projector: Projector): BaselineOutput {
  const scenario = projectScenario(current, anchorFor(current, projector.quotes), projector);
  return { ...scenario, kind: "current", label: MCP_OFFER_CURRENT_LABEL, entry_id: current.id };
}

// Package A's reference is its first scenario: the first share price given,
// or its anchor price when none is.
function packageBaseline(first: OfferPackage, projector: Projector): BaselineOutput {
  const scenario = projectScenario(first.entry, pricePoints(first, projector)[0], projector);
  return { ...scenario, kind: "package", label: first.label, entry_id: null };
}

function comparePackages(
  packages: readonly OfferPackage[],
  baseline: BaselineOutput,
  projector: Projector
): OfferOutput["packages"] {
  return packages.map((pkg) => ({
    label: pkg.label,
    scenarios: pricePoints(pkg, projector).map((point) => {
      const scenario = projectScenario(pkg.entry, point, projector);
      return { ...scenario, delta: scenario.total - baseline.total };
    }),
  }));
}

// ── loading ────────────────────────────────────────────────────────────────

async function loadCurrent(
  ctx: McpToolContext,
  compareToCurrent: boolean,
  asOf: ResolvedAsOf
): Promise<DomainResult<StoredCompEntry | null>> {
  if (!compareToCurrent) return ok(null);
  const entries = await loadEntries(ctx);
  if (!entries.ok) return entries;
  return ok(currentCompEntry(entries.value, asOf.date).current);
}

function offerSummary(output: OfferOutput): string {
  const scenarios = output.packages.reduce((count, pkg) => count + pkg.scenarios.length, 0);
  return `Evaluated ${output.packages.length} package(s), ${scenarios} scenario(s), over ${output.years.length} year(s) against ${output.baseline.label}. Not modeled: ${output.not_modeled.join(", ")}.`;
}

const evaluateOfferTool = defineTool({
  name: "evaluate_offer",
  title: "Evaluate offer",
  description: [
    `Evaluates ${MCP_EVALUATE_OFFER.minPackages}-${MCP_EVALUATE_OFFER.maxPackages} hypothetical packages without saving anything, using the comp page's vesting math.`,
    `Each package can list up to ${MCP_EVALUATE_OFFER.maxScenariosPerPackage} share prices; each becomes a scenario with year-by-year rows and a total over the projected years (starting with the as_of year). vest_start defaults to as_of.`,
    "Each scenario's delta is its total minus the baseline total. The baseline is the user's current package at its cached-quote or implied price when compare_to_current is true and one is in effect, else the first package's first scenario.",
    `Not modeled: ${MCP_OFFER_NOT_MODELED.join(", ")}.`,
    NOTES.amounts,
    NOTES.equity,
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: COMP_READ_ANNOTATIONS,
  inputSchema: {
    packages: z.array(packageInput).min(MCP_EVALUATE_OFFER.minPackages).max(MCP_EVALUATE_OFFER.maxPackages),
    years: projectionYearsInput,
    compare_to_current: z
      .boolean()
      .default(true)
      .describe("Compare with the package in effect on as_of. Default true."),
    as_of: asOfInput,
  },
  outputSchema: offerOutput,
  run: async (ctx, input) => {
    const asOf = resolveAsOf(ctx, input.as_of);
    const packages = toOfferPackages(input.packages, asOf);
    if (!packages.ok) return packages;
    const current = await loadCurrent(ctx, input.compare_to_current, asOf);
    if (!current.ok) return current;
    const tickers = [current.value?.ticker ?? null, ...packages.value.map((pkg) => pkg.entry.ticker)];
    const quotes = await loadCachedQuotes(ctx, tickers);
    if (!quotes.ok) return quotes;
    const projector: Projector = { years: projectionYears(asOf.year, input.years), asOf, quotes: quotes.value };
    const baseline = current.value
      ? currentBaseline(current.value, projector)
      : packageBaseline(packages.value[0], projector);
    const structured: OfferOutput = {
      as_of: asOf.date,
      years: projector.years,
      baseline,
      packages: comparePackages(packages.value, baseline, projector),
      not_modeled: [...MCP_OFFER_NOT_MODELED],
    };
    return ok({ structured, summary: offerSummary(structured) });
  },
});

export const COMP_OFFER_TOOLS: readonly DefinedTool[] = [evaluateOfferTool];
