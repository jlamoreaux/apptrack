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
  MCP_COMP_CURRENCY,
  MCP_COMP_DESCRIPTION_NOTES as NOTES,
  MCP_COMP_FIELD_DESCRIPTIONS as FIELD,
  MCP_COMP_MESSAGES,
  MCP_EVALUATE_OFFER,
  MCP_OFFER_CURRENT_LABEL,
  MCP_OFFER_ENTRY_ID_PREFIX,
  MCP_OFFER_NOT_MODELED,
  MCP_OFFER_PACKAGE_LABELS,
} from "@/lib/constants/mcp-comp";
import { countNoun } from "@/lib/constants/mcp-tools";
import { READ_ANNOTATIONS } from "@/lib/mcp/annotations";
import {
  defineTool,
  type DefinedTool,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import {
  asOfInput,
  jsonEncodedInput,
  resolveAsOf,
  type ResolvedAsOf,
} from "@/lib/mcp/tool-inputs";
import type { DomainResult } from "@/types";
import {
  amountInput,
  anchorFor,
  finiteNumber,
  givenPrice,
  loadCachedQuotes,
  loadEntries,
  priceFreshness,
  priceFreshnessOutput,
  priceSourceOutput,
  projectionRowOutput,
  consecutiveYears,
  projectionYearsInput,
  sharePriceInput,
  sumTotals,
  toRowOutput,
  type PricePoint,
} from "./comp-shared";

const packageFields = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(MCP_EVALUATE_OFFER.labelMax)
    .optional()
    .describe(FIELD.offer_label),
  base: amountInput.describe(FIELD.base),
  bonus: amountInput.optional().describe(FIELD.bonus),
  equity: amountInput.optional().describe(FIELD.equity),
  ticker: z.string().optional().describe(FIELD.ticker),
  shares: amountInput.optional().describe(FIELD.shares),
  vest_start: z.string().optional().describe(FIELD.offer_vest_start),
  vest_years: z.number().finite().optional().describe(FIELD.vest_years),
  vest_cliff_months: z.number().int().optional().describe(FIELD.vest_cliff_months),
  share_prices: jsonEncodedInput(
    z.array(sharePriceInput).max(MCP_EVALUATE_OFFER.maxScenariosPerPackage)
  )
    .optional()
    .describe(
      `Up to ${MCP_EVALUATE_OFFER.maxScenariosPerPackage} share prices to evaluate a share-based package at. Without them the cached quote for ticker, else equity / shares, is used.`
    ),
});
const packageInput = jsonEncodedInput(packageFields);
type PackageInput = z.output<typeof packageFields>;

const offerInput = {
  packages: jsonEncodedInput(
    z
      .array(packageInput)
      .min(MCP_EVALUATE_OFFER.minPackages)
      .max(MCP_EVALUATE_OFFER.maxPackages)
  ),
  years: projectionYearsInput,
  compare_to_current: z
    .boolean()
    .default(true)
    .describe("Compare with the package in effect on as_of. Default true."),
  as_of: asOfInput,
};

const scenarioOutput = z.object({
  share_price: finiteNumber.nullable(),
  price_source: priceSourceOutput,
  ...priceFreshnessOutput,
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

interface Projector {
  years: number[];
  asOf: ResolvedAsOf;
  now: Date;
  quotes: Readonly<Record<string, StockQuote>>;
}

// ── packages ───────────────────────────────────────────────────────────────

function toOfferPackage(
  input: PackageInput,
  index: number,
  asOf: ResolvedAsOf
): DomainResult<OfferPackage> {
  const label = input.label ?? MCP_OFFER_PACKAGE_LABELS[index];
  // The comp service ignores label and share_prices; the rest are entry fields.
  const valid = validateCompInput({
    ...input,
    effective_date: asOf.date,
    vest_start: input.vest_start ?? asOf.date,
  });
  if (!valid.ok) return invalid(`${label}: ${valid.message}`);
  const entry: CompEntry = {
    ...valid.value,
    id: `${MCP_OFFER_ENTRY_ID_PREFIX}${index}`,
    currency: MCP_COMP_CURRENCY,
  };
  const sharePrices = input.share_prices ?? [];
  if (sharePrices.length > 0 && !hasShares(entry)) {
    return invalid(`${label}: ${MCP_COMP_MESSAGES.scenariosNeedShares}`);
  }
  return ok({ label, entry, sharePrices });
}

// Labels identify packages in the result, so they must be told apart from
// each other and from the current-package baseline.
function checkLabels(packages: readonly OfferPackage[]): DomainResult<null> {
  const reserved = MCP_OFFER_CURRENT_LABEL.toLowerCase();
  const seen = new Set<string>();
  for (const { label } of packages) {
    const key = label.toLowerCase();
    if (key === reserved) return invalid(MCP_COMP_MESSAGES.reservedLabel);
    if (seen.has(key)) return invalid(MCP_COMP_MESSAGES.duplicateLabel);
    seen.add(key);
  }
  return ok(null);
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
  const labels = checkLabels(packages);
  return labels.ok ? ok(packages) : labels;
}

// ── projection ─────────────────────────────────────────────────────────────

function pricePoints(pkg: OfferPackage, projector: Projector): PricePoint[] {
  if (pkg.sharePrices.length === 0) return [anchorFor(pkg.entry, projector.quotes)];
  return pkg.sharePrices.map(givenPrice);
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
    ...priceFreshness(projector.now, point),
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

async function buildProjector(
  ctx: McpToolContext,
  current: StoredCompEntry | null,
  packages: readonly OfferPackage[],
  input: { asOf: ResolvedAsOf; years: number }
): Promise<DomainResult<Projector>> {
  const tickers = [current?.ticker ?? null, ...packages.map((pkg) => pkg.entry.ticker)];
  const quotes = await loadCachedQuotes(ctx, tickers);
  if (!quotes.ok) return quotes;
  const years = consecutiveYears(input.asOf.year, input.years);
  return ok({ years, asOf: input.asOf, now: ctx.now, quotes: quotes.value });
}

function evaluate(
  current: StoredCompEntry | null,
  packages: readonly OfferPackage[],
  projector: Projector
): OfferOutput {
  const baseline = current
    ? currentBaseline(current, projector)
    : packageBaseline(packages[0], projector);
  return {
    as_of: projector.asOf.date,
    years: projector.years,
    baseline,
    packages: comparePackages(packages, baseline, projector),
    not_modeled: [...MCP_OFFER_NOT_MODELED],
  };
}

function offerSummary(output: OfferOutput): string {
  const scenarios = output.packages.reduce((count, pkg) => count + pkg.scenarios.length, 0);
  return [
    `Evaluated ${countNoun(output.packages.length, "package", "packages")},`,
    `${countNoun(scenarios, "scenario", "scenarios")}, over`,
    `${countNoun(output.years.length, "year", "years")} against ${output.baseline.label}.`,
    `Not modeled: ${output.not_modeled.join(", ")}.`,
  ].join(" ");
}

async function runEvaluateOffer(
  ctx: McpToolContext,
  input: ToolInput<typeof offerInput>
): Promise<DomainResult<ToolSuccess<OfferOutput>>> {
  const asOf = resolveAsOf(ctx, input.as_of);
  const packages = toOfferPackages(input.packages, asOf);
  if (!packages.ok) return packages;
  const current = await loadCurrent(ctx, input.compare_to_current, asOf);
  if (!current.ok) return current;
  const projector = await buildProjector(ctx, current.value, packages.value, {
    asOf,
    years: input.years,
  });
  if (!projector.ok) return projector;
  const structured = evaluate(current.value, packages.value, projector.value);
  return ok({ structured, summary: offerSummary(structured) });
}

const evaluateOfferTool = defineTool({
  name: "evaluate_offer",
  title: "Evaluate offer",
  description: [
    `Evaluate ${MCP_EVALUATE_OFFER.minPackages}-${MCP_EVALUATE_OFFER.maxPackages} hypothetical packages without saving anything, using the comp page's vesting math.`,
    `Each package can list up to ${MCP_EVALUATE_OFFER.maxScenariosPerPackage} share prices; each becomes a scenario with year-by-year rows and a total over the projected years (starting with the as_of year). vest_start defaults to as_of.`,
    `Package labels must differ from each other and from "${MCP_OFFER_CURRENT_LABEL}".`,
    "Each scenario's delta is its total minus the baseline total. The baseline is the user's current package at its cached-quote or implied price when compare_to_current is true and one is in effect, else the first package's first scenario.",
    `Not modeled: ${MCP_OFFER_NOT_MODELED.join(", ")}.`,
    NOTES.amounts,
    NOTES.equity,
    NOTES.priceFreshness,
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: offerInput,
  outputSchema: offerOutput,
  run: runEvaluateOffer,
});

export const COMP_OFFER_TOOLS: readonly DefinedTool[] = [evaluateOfferTool];
