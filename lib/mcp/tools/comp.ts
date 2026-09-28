import type { DefinedTool } from "@/lib/mcp/define-tool";
import { COMP_OFFER_TOOLS } from "./comp-offer";
import { COMP_READ_TOOLS } from "./comp-read";
import { COMP_WRITE_TOOLS } from "./comp-write";

/** Every comp tool, reads first. Registration filters by the token's scopes. */
export const COMP_TOOLS: readonly DefinedTool[] = [
  ...COMP_READ_TOOLS,
  ...COMP_OFFER_TOOLS,
  ...COMP_WRITE_TOOLS,
];
