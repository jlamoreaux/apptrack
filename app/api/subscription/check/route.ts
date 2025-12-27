import { type NextRequest, NextResponse } from "next/server";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { PLAN_NAMES } from "@/lib/constants/plans";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      loggerService.warn('Subscription check missing user ID', {
        category: LogCategory.API,
        action: 'subscription_check_missing_user_id',
        duration: Date.now() - startTime
      });
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
    const isPro = isOnProOrHigher(subscriptionStatus.plan);

    loggerService.info('Subscription check completed', {
      category: LogCategory.BUSINESS,
      userId,
      action: 'subscription_check_success',
      duration: Date.now() - startTime,
      metadata: {
        plan: subscriptionStatus.plan,
        status: subscriptionStatus.status,
        isActive: subscriptionStatus.isActive,
        isPro
      }
    });
    
    return NextResponse.json({
      isActive: subscriptionStatus.isActive && isPro,
      subscription: {
        plan: subscriptionStatus.plan,
        status: subscriptionStatus.status,
        isActive: subscriptionStatus.isActive,
      },
    });
  } catch (error) {
    loggerService.error('Unexpected error checking subscription', error, {
      category: LogCategory.API,
      userId,
      action: 'subscription_check_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
