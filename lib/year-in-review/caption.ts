import { plural } from "./format";
import { LABELS } from "./labels";
import type { SharePayload } from "./share-token";

/**
 * Suggested post text for a share. Built from the signed payload, so it can
 * only repeat what the public page already shows.
 */
export function buildShareCaption(payload: SharePayload): string {
  let text = `My ${payload.y} job search: ${plural(payload.a, "application", "applications")} to ${plural(payload.c, "company", "companies")}`;
  if (payload.i > 0) text += `, ${plural(payload.i, "interview", "interviews")}`;
  text += ".";
  if (payload.l) text += ` My search style: ${LABELS[payload.l].name}.`;
  if (payload.hc) text += ` Landed at ${payload.hc}.`;
  return text;
}
