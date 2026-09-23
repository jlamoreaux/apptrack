/**
 * MCP tools over the wins log. Inputs are typed loosely and the wins service
 * does all business validation, so REST and MCP cannot drift. Update and
 * delete reach only rows an agent created.
 */

import { z } from "zod";
import {
  AGENT_SOURCE,
  WIN_SOURCES,
  WIN_TAGS,
} from "@/lib/constants/careerotter";
import { MCP_LIST_WINS, MCP_TOOL_FAILED_MESSAGE } from "@/lib/constants/agent-access";
import {
  WIN_AGENT_SELECT,
  WIN_REST_SELECT,
  createWin,
  deleteWin,
  listWins,
  updateWin,
  validateWinInput,
  type WinRow,
} from "@/lib/careerotter/wins-service";
import { computeCoverage } from "@/lib/careerotter/coverage";
import { dbFailure, ok } from "@/lib/careerotter/domain-result";
import {
  defineTool,
  type DefinedTool,
  type McpToolAnnotations,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import type { DomainResult } from "@/types";

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

const READ_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const EDIT_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const DELETE_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

const MISSING_AGENT_COLUMNS = "Win row is missing agent columns";

const TAG_DESCRIPTION = `Impact area, one of: ${WIN_TAGS.join(", ")}.`;
const DATE_DESCRIPTION = "Date in YYYY-MM-DD format.";
const TEXT_DESCRIPTION =
  "One or two plain first-person sentences about what the user did.";
const IMPACT_DESCRIPTION =
  "A number that shows the impact, such as \"30% faster\". Only when it appears in the source material or the user states it; never invent one.";
const EVIDENCE_URL_DESCRIPTION = "An http or https link to the evidence.";
const AGENT_ONLY_NOTE =
  "Only wins created by an agent can be changed; wins the user entered themselves are reported as not found.";

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
    id: row.id,
    text: row.text,
    impact_number: row.impact_number,
    tag: row.tag,
    source: row.source,
    created_at: row.created_at,
    edited_at: row.edited_at,
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
  text: z.string().describe(TEXT_DESCRIPTION),
  impact_number: z.string().optional().describe(IMPACT_DESCRIPTION),
  tag: z.enum(WIN_TAGS).optional().describe(TAG_DESCRIPTION),
  occurred_at: z
    .string()
    .optional()
    .describe(`When the win happened. ${DATE_DESCRIPTION} Defaults to today (UTC).`),
  evidence_url: z.string().optional().describe(EVIDENCE_URL_DESCRIPTION),
  external_ref: z
    .string()
    .optional()
    .describe(
      'Stable id of the source, as "<system>:<stable id>", for example "github:acme/api#1234". Always send it when the win comes from a PR, doc or ticket; a repeat call returns the stored win.'
    ),
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
      ? `Win already logged (external_ref match): ${win.value.id}`
      : `Logged win ${win.value.id}`,
  });
}

const logWinTool = defineTool({
  name: "log_win",
  title: "Log a win",
  description: [
    "Add a win (evidence of the user's impact) to their CareerOtter log.",
    "Log only when the user asked you to or confirmed what you propose.",
    "Write text as one or two plain first-person sentences. Never invent an impact number.",
    "When the win comes from a PR, doc or ticket, always send external_ref; retrying with the same external_ref returns the stored win with duplicate: true.",
  ].join(" "),
  scope: "wins:write",
  annotations: EDIT_ANNOTATIONS,
  inputSchema: logWinInput,
  outputSchema: logWinOutput,
  run: runLogWin,
});

// ── list_wins ──────────────────────────────────────────────────────────────

const listWinsInput = {
  since: z.string().optional().describe(`Earliest occurred_at, inclusive. ${DATE_DESCRIPTION}`),
  until: z.string().optional().describe(`Latest occurred_at, inclusive. ${DATE_DESCRIPTION}`),
  tag: z.enum(WIN_TAGS).optional().describe(TAG_DESCRIPTION),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      `Maximum wins to return, 1 to ${MCP_LIST_WINS.maxLimit}. Defaults to ${MCP_LIST_WINS.defaultLimit}.`
    ),
};
const listWinsOutput = z.object({ wins: z.array(winSchema), truncated: z.boolean() });

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
    summary: `Returned ${wins.value.length} wins${truncated ? "; more exist" : ""}`,
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
  id: z.string().uuid().describe("The win's id."),
  text: z.string().optional().describe(TEXT_DESCRIPTION),
  impact_number: z
    .string()
    .nullable()
    .optional()
    .describe(`${IMPACT_DESCRIPTION} null clears it.`),
  tag: z.enum(WIN_TAGS).nullable().optional().describe(`${TAG_DESCRIPTION} null clears it.`),
  occurred_at: z.string().optional().describe(`When the win happened. ${DATE_DESCRIPTION}`),
  evidence_url: z
    .string()
    .nullable()
    .optional()
    .describe(`${EVIDENCE_URL_DESCRIPTION} null clears it.`),
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
  return ok({ structured: { win: win.value }, summary: `Updated win ${win.value.id}` });
}

const updateWinTool = defineTool({
  name: "update_win",
  title: "Update a win",
  description: [
    "Change fields of a win. Omitted fields keep their value.",
    AGENT_ONLY_NOTE,
    "Change data only when the user asked you to or confirmed what you propose.",
  ].join(" "),
  scope: "wins:write",
  annotations: EDIT_ANNOTATIONS,
  inputSchema: updateWinInput,
  outputSchema: updateWinOutput,
  run: runUpdateWin,
});

// ── delete_win ─────────────────────────────────────────────────────────────

const deleteWinInput = { id: z.string().uuid().describe("The win's id.") };
const deleteWinOutput = z.object({ deleted_id: z.string() });

async function runDeleteWin(
  ctx: McpToolContext,
  input: ToolInput<typeof deleteWinInput>
): Promise<DomainResult<ToolSuccess<z.infer<typeof deleteWinOutput>>>> {
  const deleted = await deleteWin(ctx.admin, ctx.userId, input.id, {
    onlySource: AGENT_SOURCE,
  });
  if (!deleted.ok) return deleted;
  return ok({
    structured: { deleted_id: deleted.value.id },
    summary: `Deleted win ${deleted.value.id}`,
  });
}

const deleteWinTool = defineTool({
  name: "delete_win",
  title: "Delete a win",
  description: [
    "Permanently delete a win.",
    AGENT_ONLY_NOTE,
    "Delete only when the user asked you to or confirmed it.",
  ].join(" "),
  scope: "wins:write",
  annotations: DELETE_ANNOTATIONS,
  inputSchema: deleteWinInput,
  outputSchema: deleteWinOutput,
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
  // Unbounded: coverage is over every win, not a page of them.
  const listed = await listWins(ctx.admin, ctx.userId, { select: WIN_REST_SELECT });
  if (!listed.ok) return listed;
  const coverage = computeCoverage(listed.value.wins);
  return ok({
    structured: {
      overall_pct: coverage.overallPct,
      areas: coverage.areas,
      biggest_gap: coverage.biggestGap,
      total_wins: coverage.totalWins,
      untagged: coverage.untagged,
    },
    summary: `Case coverage ${coverage.overallPct}%`,
  });
}

const getCoverageTool = defineTool({
  name: "get_coverage",
  title: "Get case coverage",
  description: `How well the user's wins cover the four impact areas (${WIN_TAGS.join(", ")}). Each area counts toward its share up to a target number of wins; biggest_gap is the area with the fewest wins while under target, or null when every area is covered.`,
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
