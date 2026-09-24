/**
 * The result shape both MCP delete tools share. A delete of a row that is not
 * there (already deleted, never existed, or not the agent's to delete) is a
 * successful no-op, so an agent can retry a delete whose response was lost.
 */

import { z } from "zod";
import { ok } from "@/lib/careerotter/domain-result";
import type { ToolSuccess } from "@/lib/mcp/define-tool";
import type { DomainResult } from "@/types";

export const deleteOutput = z.object({
  deleted_id: z.string(),
  deleted: z.boolean(),
});
export type DeleteOutput = z.infer<typeof deleteOutput>;

export interface DeleteSummaries {
  deleted: string;
  missing: string;
}

/** Maps a service delete to the shared output, turning not_found into deleted: false. */
export function deletedOrMissing(
  result: DomainResult<unknown>,
  id: string,
  summaries: DeleteSummaries
): DomainResult<ToolSuccess<DeleteOutput>> {
  if (result.ok) {
    return ok({ structured: { deleted_id: id, deleted: true }, summary: summaries.deleted });
  }
  if (result.kind === "not_found") {
    return ok({ structured: { deleted_id: id, deleted: false }, summary: summaries.missing });
  }
  return result;
}
