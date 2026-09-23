/**
 * MCP comp write tools. Every write is attributed to the agent source, and
 * update/delete reach only rows an agent created, so a misled agent can never
 * alter or remove what the user typed in.
 */

import { z } from "zod";
import {
  createCompEntry,
  deleteCompEntry,
  updateCompEntry,
} from "@/lib/careerotter/comp-service";
import { invalid, ok } from "@/lib/careerotter/domain-result";
import { AGENT_SOURCE, EXTERNAL_REF_MAX } from "@/lib/constants/careerotter";
import { MCP_COMP_MESSAGES } from "@/lib/constants/mcp-comp";
import { defineTool, type DefinedTool, type McpToolAnnotations } from "@/lib/mcp/define-tool";
import { COMP_DESCRIPTION_NOTES as NOTES, storedEntryOutput, toEntryOutput } from "./comp-shared";

const CREATE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  // Only a call carrying external_ref is safe to repeat; the hint is static,
  // so it must describe the call without one.
  idempotentHint: false,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

const UPDATE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

const DELETE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

// Loose type-level bounds only: the comp service owns every business rule, so
// REST and MCP validate identically.
const amount = z.number().finite().nonnegative();
const calendarDate = z.string().describe("YYYY-MM-DD.");

const FIELD_DESCRIPTIONS = {
  effective_date: "The date this package took or takes effect (YYYY-MM-DD).",
  base: "Annual base salary, USD.",
  bonus: "Annual bonus, USD.",
  equity: "Total grant value when vest_years is set; annual equity when it is not. USD.",
  note: "Optional short note.",
  ticker: "Stock ticker for share-based equity, e.g. ACME.",
  shares: "Total shares in the grant.",
  vest_start: "Vesting start date (YYYY-MM-DD); defaults to effective_date in projections.",
  vest_years: "Vest length in years.",
  vest_cliff_months: "Cliff in whole months; requires vest_years.",
} as const;

const entryOutput = z.object({ entry: storedEntryOutput });

// ── add_comp_entry ─────────────────────────────────────────────────────────

const addCompEntryTool = defineTool({
  name: "add_comp_entry",
  title: "Add comp entry",
  description: [
    "Records a comp package (a new job, raise or accepted offer) as of effective_date.",
    NOTES.writeCurrency,
    NOTES.equity,
    `Send external_ref ("<system>:<stable id>", at most ${EXTERNAL_REF_MAX} characters) when the package comes from another system: repeating a call with the same external_ref returns the stored entry with duplicate: true instead of adding another.`,
  ].join(" "),
  scope: "comp:write",
  annotations: CREATE_ANNOTATIONS,
  inputSchema: {
    effective_date: calendarDate.describe(FIELD_DESCRIPTIONS.effective_date),
    base: amount.describe(FIELD_DESCRIPTIONS.base),
    bonus: amount.optional().describe(FIELD_DESCRIPTIONS.bonus),
    equity: amount.optional().describe(FIELD_DESCRIPTIONS.equity),
    note: z.string().optional().describe(FIELD_DESCRIPTIONS.note),
    ticker: z.string().optional().describe(FIELD_DESCRIPTIONS.ticker),
    shares: amount.optional().describe(FIELD_DESCRIPTIONS.shares),
    vest_start: calendarDate.optional().describe(FIELD_DESCRIPTIONS.vest_start),
    vest_years: z.number().finite().optional().describe(FIELD_DESCRIPTIONS.vest_years),
    vest_cliff_months: z.number().int().optional().describe(FIELD_DESCRIPTIONS.vest_cliff_months),
    external_ref: z.string().optional().describe("Idempotency key from the source system."),
  },
  outputSchema: z.object({ entry: storedEntryOutput, duplicate: z.boolean() }),
  run: async (ctx, input) => {
    const created = await createCompEntry(ctx.admin, ctx.userId, input, { source: AGENT_SOURCE });
    if (!created.ok) return created;
    const { entry, duplicate } = created.value;
    return ok({
      structured: { entry: toEntryOutput(entry), duplicate },
      summary: duplicate
        ? `Comp entry ${entry.id} already existed for this external_ref; nothing was added.`
        : `Added comp entry ${entry.id} effective ${entry.effective_date}.`,
    });
  },
});

// ── update_comp_entry ──────────────────────────────────────────────────────

const updateCompEntryTool = defineTool({
  name: "update_comp_entry",
  title: "Update comp entry",
  description: [
    "Changes fields of a comp entry. Omitted fields are kept; null clears a field (bonus and equity clear to 0).",
    NOTES.agentRowsOnly,
    NOTES.writeCurrency,
    NOTES.equity,
  ].join(" "),
  scope: "comp:write",
  annotations: UPDATE_ANNOTATIONS,
  inputSchema: {
    id: z.string().uuid(),
    effective_date: calendarDate.optional().describe(FIELD_DESCRIPTIONS.effective_date),
    base: amount.optional().describe(FIELD_DESCRIPTIONS.base),
    bonus: amount.nullable().optional().describe(FIELD_DESCRIPTIONS.bonus),
    equity: amount.nullable().optional().describe(FIELD_DESCRIPTIONS.equity),
    note: z.string().nullable().optional().describe(FIELD_DESCRIPTIONS.note),
    ticker: z.string().nullable().optional().describe(FIELD_DESCRIPTIONS.ticker),
    shares: amount.nullable().optional().describe(FIELD_DESCRIPTIONS.shares),
    vest_start: calendarDate.nullable().optional().describe(FIELD_DESCRIPTIONS.vest_start),
    vest_years: z.number().finite().nullable().optional().describe(FIELD_DESCRIPTIONS.vest_years),
    vest_cliff_months: z.number().int().nullable().optional().describe(FIELD_DESCRIPTIONS.vest_cliff_months),
  },
  outputSchema: entryOutput,
  run: async (ctx, input) => {
    const { id, ...patch } = input;
    if (Object.values(patch).every((value) => value === undefined)) {
      return invalid(MCP_COMP_MESSAGES.emptyPatch);
    }
    const updated = await updateCompEntry(ctx.admin, ctx.userId, id, patch, { onlySource: AGENT_SOURCE });
    if (!updated.ok) return updated;
    return ok({
      structured: { entry: toEntryOutput(updated.value) },
      summary: `Updated comp entry ${updated.value.id}.`,
    });
  },
});

// ── delete_comp_entry ──────────────────────────────────────────────────────

const deleteCompEntryTool = defineTool({
  name: "delete_comp_entry",
  title: "Delete comp entry",
  description: ["Permanently deletes a comp entry.", NOTES.agentRowsOnly].join(" "),
  scope: "comp:write",
  annotations: DELETE_ANNOTATIONS,
  inputSchema: { id: z.string().uuid() },
  outputSchema: z.object({ id: z.string() }),
  run: async (ctx, input) => {
    const deleted = await deleteCompEntry(ctx.admin, ctx.userId, input.id, { onlySource: AGENT_SOURCE });
    if (!deleted.ok) return deleted;
    return ok({ structured: { id: deleted.value.id }, summary: `Deleted comp entry ${deleted.value.id}.` });
  },
});

export const COMP_WRITE_TOOLS: readonly DefinedTool[] = [
  addCompEntryTool,
  updateCompEntryTool,
  deleteCompEntryTool,
];
