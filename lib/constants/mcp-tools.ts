/**
 * Description text, bounds and messages shared by every CareerOtter MCP tool
 * (lib/mcp/tools/*). Tool descriptions are imperative ("Log a win") and every
 * summary is a sentence ending with a period.
 */

import { EXTERNAL_REF_MAX, WIN_TAGS } from "@/lib/constants/careerotter";
import { ISO_DATE_FORMAT } from "@/lib/constants/dates";

// Career data starts in the Unix era; an earlier date is a typo, and the
// wins service already refuses occurred_at before 1970.
export const MCP_DATE_MIN_YEAR = 1970;

export const MCP_DATE_FORMAT_NOTE = `Date in ${ISO_DATE_FORMAT} format.`;
export const MCP_DEFAULTS_TO_TODAY = "Defaults to today (UTC).";

/** The validation message for a date argument that is not a real date from MCP_DATE_MIN_YEAR on. */
export function mcpDateMessage(field: string): string {
  return `${field} must be a real date in ${ISO_DATE_FORMAT} format, in ${MCP_DATE_MIN_YEAR} or later`;
}

export const MCP_AS_OF_MESSAGE = mcpDateMessage("as_of");

export const MCP_AS_OF_DESCRIPTION = `The date to evaluate as of (${ISO_DATE_FORMAT}). ${MCP_DEFAULTS_TO_TODAY}`;

export const MCP_EXTERNAL_REF_DESCRIPTION = `Stable id of the source, as "<system>:<stable id>" (for example "github:acme/api#1234"), at most ${EXTERNAL_REF_MAX} characters. A repeat call with the same external_ref returns the stored row instead of adding another.`;

export const MCP_CONFIRM_BEFORE_WRITE =
  "Write only when the user asked you to or confirmed what you propose.";
export const MCP_CONFIRM_BEFORE_DELETE = "Delete only when the user asked you to or confirmed it.";

/** States that update and delete reach only rows an agent created. */
export function agentRowsOnlyNote(plural: string): string {
  return `Only ${plural} an agent created (source "agent") can be updated or deleted; ${plural} the user entered are never changed.`;
}

/** Update reports a row it may not touch as not found. */
export function updateNotFoundNote(plural: string): string {
  return `Updating any other id, including ${plural} the user entered, reports not found.`;
}

/** Delete is safe to retry: a missing row is a successful no-op. */
export function deleteRetryNote(noun: string): string {
  return `Deleting an id with no agent-created ${noun} (already deleted, never existed, or entered by the user) succeeds with deleted: false, so a retry is safe.`;
}

/** Explains the duplicate flag of a create tool that takes external_ref. */
export function duplicateNote(noun: string, updateTool: string): string {
  return `When external_ref matches a stored ${noun}, that ${noun} is returned unchanged with duplicate: true and the new values are not applied; use ${updateTool} to change it.`;
}

export function duplicateSummary(noun: string, id: string, updateTool: string): string {
  return `A ${noun} with this external_ref already exists (${id}); it was returned unchanged and the new values were not applied. Use ${updateTool} to change it.`;
}

export function nothingToDeleteSummary(noun: string): string {
  return `Nothing to delete: no agent-created ${noun} with that id.`;
}

/** "1 win", "3 wins". */
export function countNoun(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// A serializer found a row without a column its select list names.
export const MISSING_AGENT_COLUMNS = "Row is missing agent columns";

export const MCP_WIN_DESCRIPTIONS = {
  tag: `Impact area, one of: ${WIN_TAGS.join(", ")}.`,
  text: "One or two plain first-person sentences about what the user did.",
  impactNumber:
    'A number that shows the impact, such as "30% faster". Only when it appears in the source material or the user states it; never invent one.',
  evidenceUrl: "An http or https link to the evidence.",
  occurredAt: "When the win happened.",
  clears: "null clears it.",
} as const;

/** How descriptions and summaries name each record type. */
export const MCP_RECORD_NOUNS = {
  win: { singular: "win", plural: "wins" },
  compEntry: { singular: "comp entry", plural: "comp entries" },
} as const;
