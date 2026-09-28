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
import { AGENT_SOURCE } from "@/lib/constants/careerotter";
import {
  MCP_COMP_DESCRIPTION_NOTES as NOTES,
  MCP_COMP_FIELD_DESCRIPTIONS as FIELD,
  MCP_COMP_MESSAGES,
} from "@/lib/constants/mcp-comp";
import {
  MCP_CONFIRM_BEFORE_DELETE,
  MCP_CONFIRM_BEFORE_WRITE,
  MCP_RECORD_NOUNS,
  agentRowsOnlyNote,
  deleteRetryNote,
  duplicateNote,
  duplicateSummary,
  nothingToDeleteSummary,
  updateNotFoundNote,
} from "@/lib/constants/mcp-tools";
import {
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  UPDATE_ANNOTATIONS,
} from "@/lib/mcp/annotations";
import type { McpToolContext } from "@/lib/mcp/context";
import { deleteOutput, deletedOrMissing, type DeleteOutput } from "@/lib/mcp/delete-output";
import {
  defineTool,
  type DefinedTool,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import { externalRefInput, recordIdInput } from "@/lib/mcp/tool-inputs";
import type { DomainResult } from "@/types";
import { amountInput, storedEntryOutput, toEntryOutput } from "./comp-shared";

const { singular: ENTRY, plural: ENTRIES } = MCP_RECORD_NOUNS.compEntry;
const UPDATE_TOOL = "update_comp_entry";

// Dates stay plain strings: the comp service validates them, as for REST.
const dateInput = z.string();
const vestYearsInput = z.number().finite();
const cliffMonthsInput = z.number().int();

// ── add_comp_entry ─────────────────────────────────────────────────────────

const addInput = {
  effective_date: dateInput.describe(FIELD.effective_date),
  base: amountInput.describe(FIELD.base),
  bonus: amountInput.optional().describe(FIELD.bonus),
  equity: amountInput.optional().describe(FIELD.equity),
  note: z.string().optional().describe(FIELD.note),
  ticker: z.string().optional().describe(FIELD.ticker),
  shares: amountInput.optional().describe(FIELD.shares),
  vest_start: dateInput.optional().describe(FIELD.vest_start),
  vest_years: vestYearsInput.optional().describe(FIELD.vest_years),
  vest_cliff_months: cliffMonthsInput.optional().describe(FIELD.vest_cliff_months),
  external_ref: externalRefInput,
};
const addOutput = z.object({ entry: storedEntryOutput, duplicate: z.boolean() });

async function runAddCompEntry(
  ctx: McpToolContext,
  input: ToolInput<typeof addInput>
): Promise<DomainResult<ToolSuccess<z.infer<typeof addOutput>>>> {
  const created = await createCompEntry(ctx.admin, ctx.userId, input, { source: AGENT_SOURCE });
  if (!created.ok) return created;
  const { entry, duplicate } = created.value;
  return ok({
    structured: { entry: toEntryOutput(entry), duplicate },
    summary: duplicate
      ? duplicateSummary(ENTRY, entry.id, UPDATE_TOOL)
      : `Added comp entry ${entry.id} effective ${entry.effective_date}.`,
  });
}

const addCompEntryTool = defineTool({
  name: "add_comp_entry",
  title: "Add comp entry",
  description: [
    "Add a comp package (a new job, raise or accepted offer) as of effective_date.",
    MCP_CONFIRM_BEFORE_WRITE,
    NOTES.writeCurrency,
    NOTES.equity,
    "Send external_ref when the package comes from another system.",
    duplicateNote(ENTRY, UPDATE_TOOL),
  ].join(" "),
  scope: "comp:write",
  annotations: CREATE_ANNOTATIONS,
  inputSchema: addInput,
  outputSchema: addOutput,
  run: runAddCompEntry,
});

// ── update_comp_entry ──────────────────────────────────────────────────────

const updateInput = {
  id: recordIdInput(ENTRY),
  effective_date: dateInput.optional().describe(FIELD.effective_date),
  base: amountInput.optional().describe(FIELD.base),
  bonus: amountInput.nullable().optional().describe(FIELD.bonus),
  equity: amountInput.nullable().optional().describe(FIELD.equity),
  note: z.string().nullable().optional().describe(FIELD.note),
  ticker: z.string().nullable().optional().describe(FIELD.ticker),
  shares: amountInput.nullable().optional().describe(FIELD.shares),
  vest_start: dateInput.nullable().optional().describe(FIELD.vest_start),
  vest_years: vestYearsInput.nullable().optional().describe(FIELD.vest_years),
  vest_cliff_months: cliffMonthsInput.nullable().optional().describe(FIELD.vest_cliff_months),
};
const entryOutput = z.object({ entry: storedEntryOutput });

async function runUpdateCompEntry(
  ctx: McpToolContext,
  input: ToolInput<typeof updateInput>
): Promise<DomainResult<ToolSuccess<z.infer<typeof entryOutput>>>> {
  const { id, ...patch } = input;
  if (Object.values(patch).every((value) => value === undefined)) {
    return invalid(MCP_COMP_MESSAGES.emptyPatch);
  }
  const updated = await updateCompEntry(ctx.admin, ctx.userId, id, patch, {
    onlySource: AGENT_SOURCE,
  });
  if (!updated.ok) return updated;
  return ok({
    structured: { entry: toEntryOutput(updated.value) },
    summary: `Updated comp entry ${updated.value.id}.`,
  });
}

const updateCompEntryTool = defineTool({
  name: UPDATE_TOOL,
  title: "Update comp entry",
  description: [
    "Change fields of a comp entry. Omitted fields are kept; null clears a field (bonus and equity clear to 0).",
    agentRowsOnlyNote(ENTRIES),
    updateNotFoundNote(ENTRIES),
    MCP_CONFIRM_BEFORE_WRITE,
    NOTES.writeCurrency,
    NOTES.equity,
  ].join(" "),
  scope: "comp:write",
  annotations: UPDATE_ANNOTATIONS,
  inputSchema: updateInput,
  outputSchema: entryOutput,
  run: runUpdateCompEntry,
});

// ── delete_comp_entry ──────────────────────────────────────────────────────

const deleteInput = { id: recordIdInput(ENTRY) };

async function runDeleteCompEntry(
  ctx: McpToolContext,
  input: ToolInput<typeof deleteInput>
): Promise<DomainResult<ToolSuccess<DeleteOutput>>> {
  const deleted = await deleteCompEntry(ctx.admin, ctx.userId, input.id, {
    onlySource: AGENT_SOURCE,
  });
  return deletedOrMissing(deleted, input.id, {
    deleted: `Deleted comp entry ${input.id}.`,
    missing: nothingToDeleteSummary(ENTRY),
  });
}

const deleteCompEntryTool = defineTool({
  name: "delete_comp_entry",
  title: "Delete comp entry",
  description: [
    "Permanently delete a comp entry.",
    agentRowsOnlyNote(ENTRIES),
    deleteRetryNote(ENTRY),
    MCP_CONFIRM_BEFORE_DELETE,
  ].join(" "),
  scope: "comp:write",
  annotations: DELETE_ANNOTATIONS,
  inputSchema: deleteInput,
  outputSchema: deleteOutput,
  run: runDeleteCompEntry,
});

export const COMP_WRITE_TOOLS: readonly DefinedTool[] = [
  addCompEntryTool,
  updateCompEntryTool,
  deleteCompEntryTool,
];
