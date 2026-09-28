/**
 * The four annotation sets every CareerOtter MCP tool uses. Hints are static,
 * so each set describes the least safe call its tools accept.
 */

import type { McpToolAnnotations } from "@/lib/mcp/define-tool";

export const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

// Only a call carrying external_ref is safe to repeat; a call without one adds
// another row each time.
export const CREATE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

// Every update stamps updated_at / edited_at, so repeating the same call still
// changes the stored row.
export const UPDATE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

// Deleting an id that is already gone succeeds with deleted: false.
export const DELETE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;
