import { type NextRequest, NextResponse } from "next/server";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { PLAN_NAMES } from "@/lib/constants/plans";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS },
        { status: 400 }
      );
    }

    const subscriptionService = new SubscriptionService();

    // Get user's current subscription status
    const subscriptionStatus = await subscriptionService.getSubscriptionStatus(
      userId
    );

    // Check if subscription is for Pro plan or higher
    const isPro =
      subscriptionStatus.plan === PLAN_NAMES.PRO ||
      subscriptionStatus.plan === PLAN_NAMES.AI_COACH;

    return NextResponse.json({
      isActive: subscriptionStatus.isActive && isPro,
      subscription: {
        plan: subscriptionStatus.plan,
        status: subscriptionStatus.status,
        isActive: subscriptionStatus.isActive,
      },
    });
  } catch (error) {
    console.error("Unexpected error checking subscription:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
