/**
 * Wins API — the evidence log (CareerOtter Phase 2, M2).
 *
 * GET  /api/wins        list the current user's wins (newest first)
 * POST /api/wins        log a win
 *
 * Logging is FREE and calls no model (habit before payment, PRD M2). Auth is the
 * session user; reads and writes go through lib/careerotter/wins-service.ts on
 * the service-role admin client because the wins table is RLS service-role-only,
 * and every query is scoped to the session user_id so the admin client can't
 * leak across users.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { emailDistinctId } from "@/lib/analytics/anonymize";
import {
  WIN_REST_SELECT,
  createWin,
  listWins,
  validateWinInput,
} from "@/lib/careerotter/wins-service";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listWins(createAdminClient(), user.id, {
    select: WIN_REST_SELECT,
    sort: "created_desc",
  });
  if (!result.ok) return domainErrorResponse(result);

  return NextResponse.json({ wins: result.value.wins });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = validateWinInput(body, { allowAgentFields: false });
  if (!input.ok) return domainErrorResponse(input);

  // Provenance is server-authoritative: this manual endpoint always records
  // "manual". Client-supplied `source` is ignored so callers can't forge
  // "zero_to_case"/"recap"/"import"/"agent".
  const result = await createWin(createAdminClient(), user.id, input.value, {
    source: "manual",
    select: WIN_REST_SELECT,
    distinctId: user.id ?? emailDistinctId(user.email ?? ""),
  });
  if (!result.ok) return domainErrorResponse(result);

  return NextResponse.json({ win: result.value.win }, { status: 201 });
}
