/**
 * MCP tools over the wins log. Inputs are typed loosely and the wins service
 * does all business validation, so REST and MCP cannot drift. Update and
 * delete reach only rows an agent created.
 */

import { z } from "zod";
import { AGENT_SOURCE, WIN_SOURCES, WIN_TAGS } from "@/lib/constants/careerotter";
import { MCP_LIST_WINS, MCP_TOOL_FAILED_MESSAGE } from "@/lib/constants/agent-access";
import {
  MCP_CONFIRM_BEFORE_DELETE,
  MCP_CONFIRM_BEFORE_WRITE,
  MCP_DATE_FORMAT_NOTE,
  MCP_DEFAULTS_TO_TODAY,
  MCP_WIN_DESCRIPTIONS as FIELD,
  MCP_RECORD_NOUNS,
  MISSING_AGENT_COLUMNS,
  agentRowsOnlyNote,
  countNoun,
  deleteRetryNote,
  duplicateNote,
  duplicateSummary,
  nothingToDeleteSummary,
  updateNotFoundNote,
} from "@/lib/constants/mcp-tools";
import {
  WIN_AGENT_SELECT,
  countWinsByTag,
  createWin,
  deleteWin,
  listWins,
  updateWin,
  validateWinInput,
  type WinRow,
} from "@/lib/careerotter/wins-service";
import { COVERAGE_TARGET_PER_AREA, coverageFromCounts } from "@/lib/careerotter/coverage";
import { dbFailure, ok } from "@/lib/careerotter/domain-result";
import {
  CREATE_ANNOTATIONS,
  DELETE_ANNOTATIONS,
  READ_ANNOTATIONS,
  UPDATE_ANNOTATIONS,
} from "@/lib/mcp/annotations";
import {
  defineTool,
  type DefinedTool,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { externalRefInput, recordIdInput } from "@/lib/mcp/tool-inputs";
import { deleteOutput, deletedOrMissing, type DeleteOutput } from "@/lib/mcp/delete-output";
import type { DomainResult } from "@/types";

const { singular: WIN, plural: WINS } = MCP_RECORD_NOUNS.win;
const UPDATE_TOOL = "update_win";

// ── shared schemas ─────────────────────────────────────────────────────────

const winSchema = z.object({
  id: z.string(),
  text: z.string(),
  impact_number: z.string().nullable(),
  tag: z.enum(WIN_TAGS).nullable(),
  source: z.enum(WIN_SOURCES),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  occurred_at: z.string(),
  evidence_url: z.string().nullable(),
  external_ref: z.string().nullable(),
});
type AgentWin = z.infer<typeof winSchema>;

const tagInput = z.enum(WIN_TAGS);

// occurred_at is NOT NULL and part of WIN_AGENT_SELECT, so a row without it
// means the select list and this serializer disagree.
function toAgentWin(ctx: McpToolContext, row: WinRow): DomainResult<AgentWin> {
  if (row.occurred_at === undefined) {
    return dbFailure(
      {
        userId: ctx.userId,
        action: "mcp_win_serialize",
        logMessage: MISSING_AGENT_COLUMNS,
        publicMessage: MCP_TOOL_FAILED_MESSAGE,
      },
      new Error(MISSING_AGENT_COLUMNS)
    );
  }
  return ok({
    ...row,
    occurred_at: row.occurred_at,
    evidence_url: row.evidence_url ?? null,
    external_ref: row.external_ref ?? null,
  });
}

function toAgentWins(ctx: McpToolContext, rows: readonly WinRow[]): DomainResult<AgentWin[]> {
  const wins: AgentWin[] = [];
  for (const row of rows) {
    const win = toAgentWin(ctx, row);
    if (!win.ok) return win;
    wins.push(win.value);
  }
  return ok(wins);
}

// ── log_win ────────────────────────────────────────────────────────────────

const logWinInput = {
  text: z.string().describe(FIELD.text),
  impact_number: z.string().optional().describe(FIELD.impactNumber),
  tag: tagInput.optional().describe(FIELD.tag),
  occurred_at: z
    .string()
    .optional()
    .describe(`${FIELD.occurredAt} ${MCP_DATE_FORMAT_NOTE} ${MCP_DEFAULTS_TO_TODAY}`),
  evidence_url: z.string().optional().describe(FIELD.evidenceUrl),
  external_ref: externalRefInput,
};
const logWinOutput = z.object({ win: winSchema, duplicate: z.boolean() });

async function runLogWin(
  ctx: McpToolContext,
  input: ToolInput<typeof logWinInput>
): Promise<DomainResult<ToolSuccess<z.infer<typeof logWinOutput>>>> {
  const valid = validateWinInput(input, { allowAgentFields: true });
  if (!valid.ok) return valid;
  const created = await createWin(ctx.admin, ctx.userId, valid.value, {
    source: AGENT_SOURCE,
    select: WIN_AGENT_SELECT,
  });
  if (!created.ok) return created;
  const win = toAgentWin(ctx, created.value.win);
  if (!win.ok) return win;
  const { duplicate } = created.value;
  return ok({
    structured: { win: win.value, duplicate },
    summary: duplicate
      ? duplicateSummary(WIN, win.value.id, UPDATE_TOOL)
      : `Logged win ${win.value.id}.`,
  });
}

const logWinTool = defineTool({
  name: "log_win",
  title: "Log a win",
  description: [
    "Log a win (evidence of the user's impact) to their CareerOtter log.",
    MCP_CONFIRM_BEFORE_WRITE,
    "Write text as one or two plain first-person sentences. Never invent an impact number.",
    "When the win comes from a PR, doc or ticket, always send external_ref.",
    duplicateNote(WIN, UPDATE_TOOL),
  ].join(" "),
  scope: "wins:write",
  annotations: CREATE_ANNOTATIONS,
  inputSchema: logWinInput,
  outputSchema: logWinOutput,
  run: runLogWin,
});

// ── list_wins ──────────────────────────────────────────────────────────────

const listWinsInput = {
  since: z.string().optional().describe(`Earliest occurred_at, inclusive. ${MCP_DATE_FORMAT_NOTE}`),
  until: z
    .string()
    .optional()
    .describe(`Latest occurred_at, inclusive; not before since. ${MCP_DATE_FORMAT_NOTE}`),
  tag: tagInput.optional().describe(FIELD.tag),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      `Maximum wins to return, 1 to ${MCP_LIST_WINS.maxLimit}. Defaults to ${MCP_LIST_WINS.defaultLimit}.`
    ),
};
const listWinsOutput = z.object({ wins: z.array(winSchema), truncated: z.boolean() });

function listSummary(count: number, truncated: boolean): string {
  const returned = `Returned ${countNoun(count, WIN, WINS)}`;
  return truncated ? `${returned}; more exist.` : `${returned}.`;
}

async function runListWins(
  ctx: McpToolContext,
  input: ToolInput<typeof listWinsInput>
): Promise<DomainResult<ToolSuccess<z.infer<typeof listWinsOutput>>>> {
  const listed = await listWins(ctx.admin, ctx.userId, {
    since: input.since,
    until: input.until,
    tag: input.tag,
    limit: input.limit ?? MCP_LIST_WINS.defaultLimit,
    select: WIN_AGENT_SELECT,
    sort: "occurred_desc",
  });
  if (!listed.ok) return listed;
  const wins = toAgentWins(ctx, listed.value.wins);
  if (!wins.ok) return wins;
  const { truncated } = listed.value;
  return ok({
    structured: { wins: wins.value, truncated },
    summary: listSummary(wins.value.length, truncated),
  });
}

const listWinsTool = defineTool({
  name: "list_wins",
  title: "List wins",
  description:
    "List the user's wins, newest occurred_at first. since and until filter on occurred_at (inclusive). truncated is true when more wins match than were returned.",
  scope: "wins:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: listWinsInput,
  outputSchema: listWinsOutput,
  run: runListWins,
});

// ── update_win ─────────────────────────────────────────────────────────────

const updateWinInput = {
  id: recordIdInput(WIN),
  text: z.string().optional().describe(FIELD.text),
  impact_number: z.string().nullable().optional().describe(`${FIELD.impactNumber} ${FIELD.clears}`),
  tag: tagInput.nullable().optional().describe(`${FIELD.tag} ${FIELD.clears}`),
  occurred_at: z.string().optional().describe(`${FIELD.occurredAt} ${MCP_DATE_FORMAT_NOTE}`),
  evidence_url: z.string().nullable().optional().describe(`${FIELD.evidenceUrl} ${FIELD.clears}`),
};
const updateWinOutput = z.object({ win: winSchema });

async function runUpdateWin(
  ctx: McpToolContext,
  input: ToolInput<typeof updateWinInput>
): Promise<DomainResult<ToolSuccess<z.infer<typeof updateWinOutput>>>> {
  const { id, ...patch } = input;
  const updated = await updateWin(ctx.admin, ctx.userId, id, patch, {
    onlySource: AGENT_SOURCE,
    select: WIN_AGENT_SELECT,
    allowAgentFields: true,
  });
  if (!updated.ok) return updated;
  const win = toAgentWin(ctx, updated.value);
  if (!win.ok) return win;
  return ok({ structured: { win: win.value }, summary: `Updated win ${win.value.id}.` });
}

const updateWinTool = defineTool({
  name: UPDATE_TOOL,
  title: "Update a win",
  description: [
    "Change fields of a win. Omitted fields keep their value.",
    agentRowsOnlyNote(WINS),
    updateNotFoundNote(WINS),
    MCP_CONFIRM_BEFORE_WRITE,
  ].join(" "),
  scope: "wins:write",
  annotations: UPDATE_ANNOTATIONS,
  inputSchema: updateWinInput,
  outputSchema: updateWinOutput,
  run: runUpdateWin,
});

// ── delete_win ─────────────────────────────────────────────────────────────

const deleteWinInput = { id: recordIdInput(WIN) };

async function runDeleteWin(
  ctx: McpToolContext,
  input: ToolInput<typeof deleteWinInput>
): Promise<DomainResult<ToolSuccess<DeleteOutput>>> {
  const deleted = await deleteWin(ctx.admin, ctx.userId, input.id, {
    onlySource: AGENT_SOURCE,
  });
  return deletedOrMissing(deleted, input.id, {
    deleted: `Deleted win ${input.id}.`,
    missing: nothingToDeleteSummary(WIN),
  });
}

const deleteWinTool = defineTool({
  name: "delete_win",
  title: "Delete a win",
  description: [
    "Permanently delete a win.",
    agentRowsOnlyNote(WINS),
    deleteRetryNote(WIN),
    MCP_CONFIRM_BEFORE_DELETE,
  ].join(" "),
  scope: "wins:write",
  annotations: DELETE_ANNOTATIONS,
  inputSchema: deleteWinInput,
  outputSchema: deleteOutput,
  run: runDeleteWin,
});

// ── get_coverage ───────────────────────────────────────────────────────────

const coverageOutput = z.object({
  overall_pct: z.number().finite(),
  areas: z.array(
    z.object({
      tag: z.enum(WIN_TAGS),
      count: z.number().int(),
      pct: z.number().finite(),
    })
  ),
  biggest_gap: z.enum(WIN_TAGS).nullable(),
  total_wins: z.number().int(),
  untagged: z.number().int(),
});

async function runGetCoverage(
  ctx: McpToolContext
): Promise<DomainResult<ToolSuccess<z.infer<typeof coverageOutput>>>> {
  const counts = await countWinsByTag(ctx.admin, ctx.userId);
  if (!counts.ok) return counts;
  const coverage = coverageFromCounts(counts.value);
  return ok({
    structured: {
      overall_pct: coverage.overallPct,
      areas: coverage.areas,
      biggest_gap: coverage.biggestGap,
      total_wins: coverage.totalWins,
      untagged: coverage.untagged,
    },
    summary: `Case coverage ${coverage.overallPct}%.`,
  });
}

const getCoverageTool = defineTool({
  name: "get_coverage",
  title: "Get case coverage",
  description: [
    `Get how well the user's wins cover the ${WIN_TAGS.length} impact areas (${WIN_TAGS.join(", ")}).`,
    `Each area counts toward its share up to ${COVERAGE_TARGET_PER_AREA} wins; overall_pct is the average across areas.`,
    "biggest_gap is the area with the fewest wins while under target, or null when every area is covered. untagged wins count toward no area.",
  ].join(" "),
  scope: "wins:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: {},
  outputSchema: coverageOutput,
  run: runGetCoverage,
});

/** The wins tools, in list order. */
export const WIN_TOOLS: readonly DefinedTool[] = [
  logWinTool,
  listWinsTool,
  updateWinTool,
  deleteWinTool,
  getCoverageTool,
];
