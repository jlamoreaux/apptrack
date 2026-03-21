import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TrialBudgetService } from "@/lib/services/trial-budget.service";

/**
 * GET /api/ai-coach/trial-budget
 *
 * Returns the current trial budget state for the authenticated user.
 * Used by frontend components to render the persistent counter,
 * gate submit buttons, and decide whether to show onboarding.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const budget = await TrialBudgetService.getBudgetState(user.id);

  return NextResponse.json(budget);
}

/**
 * POST /api/ai-coach/trial-budget
 *
 * Marks trial onboarding as completed for the authenticated user.
 * Called once after the user dismisses the tool discovery interstitial.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await TrialBudgetService.completeOnboarding(user.id);

  return NextResponse.json({ success: true });
}
