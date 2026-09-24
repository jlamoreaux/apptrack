/**
 * Maps a failed service-layer DomainResult onto the REST error response shape
 * ({ error } with the matching HTTP status). The message is already safe to
 * show: services never include database error text.
 */

import { NextResponse } from "next/server";
import type { DomainErrorKind } from "@/types";

export const DOMAIN_ERROR_STATUS = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  quota: 429,
  db: 500,
} as const satisfies Record<DomainErrorKind, number>;

/** JSON error response for a failed service call. */
export function domainErrorResponse(failure: {
  kind: DomainErrorKind;
  message: string;
}): NextResponse {
  return NextResponse.json(
    { error: failure.message },
    { status: DOMAIN_ERROR_STATUS[failure.kind] }
  );
}
