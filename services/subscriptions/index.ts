import {
  BaseService,
  ServiceError,
  ValidationServiceError,
  NotFoundServiceError,
  wrapDALError,
} from "../base";
import {
  SubscriptionDAL,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "@/dal/subscriptions";
import type { Subscription } from "@/types";
import { PLAN_NAMES } from "@/lib/constants/plans";

export class SubscriptionService
  implements
    BaseService<Subscription, CreateSubscriptionInput, UpdateSubscriptionInput>
{
  private subscriptionDAL = new SubscriptionDAL();

  async create(data: CreateSubscriptionInput): Promise<Subscription> {
    try {
      // Validate required fields
      if (!data.user_id?.trim()) {
        throw new ValidationServiceError("User ID is required");
      }

      if (!data.plan_name?.trim()) {
        throw new ValidationServiceError("Plan name is required");
      }

      // Validate plan name
      if (!Object.values(PLAN_NAMES).includes(data.plan_name as any)) {
        throw new ValidationServiceError(
          `Invalid plan name: ${data.plan_name}`
        );
      }

      // Validate dates
      if (data.current_period_start && data.current_period_end) {
        const startDate = new Date(data.current_period_start);
        const endDate = new Date(data.current_period_end);

        if (startDate >= endDate) {
          throw new ValidationServiceError(
            "Current period start must be before current period end"
          );
        }
      }

      const subscription = await this.subscriptionDAL.create(data);
      return subscription;
    } catch (error) {
      throw wrapDALError(error, "Failed to create subscription");
    }
  }

  async findById(id: string): Promise<Subscription | null> {
    try {
      return await this.subscriptionDAL.findById(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to find subscription");
    }
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    try {
      return await this.subscriptionDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to find subscriptions");
    }
  }

  async update(
    id: string,
    data: UpdateSubscriptionInput
  ): Promise<Subscription | null> {
    try {
      // Validate plan name if provided
      if (
        data.plan_name &&
        !Object.values(PLAN_NAMES).includes(data.plan_name as any)
      ) {
        throw new ValidationServiceError(
          `Invalid plan name: ${data.plan_name}`
        );
      }

      // Validate dates if provided
      if (data.current_period_start && data.current_period_end) {
        const startDate = new Date(data.current_period_start);
        const endDate = new Date(data.current_period_end);

        if (startDate >= endDate) {
          throw new ValidationServiceError(
            "Current period start must be before current period end"
          );
        }
      }

      const subscription = await this.subscriptionDAL.update(id, data);
      if (!subscription) {
        throw new NotFoundServiceError("Subscription", id);
      }

      return subscription;
    } catch (error) {
      throw wrapDALError(error, "Failed to update subscription");
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const success = await this.subscriptionDAL.delete(id);
      if (!success) {
        throw new NotFoundServiceError("Subscription", id);
      }
      return success;
    } catch (error) {
      throw wrapDALError(error, "Failed to delete subscription");
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      return await this.subscriptionDAL.exists(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to check subscription existence");
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      return await this.subscriptionDAL.count(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to count subscriptions");
    }
  }

  // Subscription-specific methods
  async getActiveSubscription(userId: string): Promise<Subscription | null> {
    try {
      return await this.subscriptionDAL.getActiveSubscription(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get active subscription");
    }
  }

  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    try {
      return await this.subscriptionDAL.getCurrentSubscription(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get current subscription");
    }
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string
  ): Promise<Subscription | null> {
    try {
      return await this.subscriptionDAL.findByStripeSubscriptionId(
        stripeSubscriptionId
      );
    } catch (error) {
      throw wrapDALError(error, "Failed to find subscription by Stripe ID");
    }
  }

  async findByStripeCustomerId(
    stripeCustomerId: string
  ): Promise<Subscription[]> {
    try {
      return await this.subscriptionDAL.findByStripeCustomerId(
        stripeCustomerId
      );
    } catch (error) {
      throw wrapDALError(
        error,
        "Failed to find subscriptions by Stripe customer ID"
      );
    }
  }

  async cancelSubscription(id: string): Promise<Subscription | null> {
    try {
      const subscription = await this.subscriptionDAL.cancelSubscription(id);
      if (!subscription) {
        throw new NotFoundServiceError("Subscription", id);
      }
      return subscription;
    } catch (error) {
      throw wrapDALError(error, "Failed to cancel subscription");
    }
  }

  async reactivateSubscription(id: string): Promise<Subscription | null> {
    try {
      const subscription = await this.subscriptionDAL.reactivateSubscription(
        id
      );
      if (!subscription) {
        throw new NotFoundServiceError("Subscription", id);
      }
      return subscription;
    } catch (error) {
      throw wrapDALError(error, "Failed to reactivate subscription");
    }
  }

  async updateFromStripeWebhook(
    stripeSubscriptionId: string,
    data: Partial<UpdateSubscriptionInput>
  ): Promise<Subscription | null> {
    try {
      return await this.subscriptionDAL.updateFromStripeWebhook(
        stripeSubscriptionId,
        data
      );
    } catch (error) {
      throw wrapDALError(error, "Failed to update subscription from webhook");
    }
  }

  // Business logic methods
  async getUserPlan(userId: string): Promise<string> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      return subscription?.plan_name || PLAN_NAMES.FREE;
    } catch (error) {
      throw wrapDALError(error, "Failed to get user plan");
    }
  }

  async isUserOnPaidPlan(userId: string): Promise<boolean> {
    try {
      const plan = await this.getUserPlan(userId);
      return plan === PLAN_NAMES.PRO || plan === PLAN_NAMES.AI_COACH;
    } catch (error) {
      throw wrapDALError(error, "Failed to check if user is on paid plan");
    }
  }

  async isUserOnProOrHigher(userId: string): Promise<boolean> {
    try {
      const plan = await this.getUserPlan(userId);
      return plan === PLAN_NAMES.PRO || plan === PLAN_NAMES.AI_COACH;
    } catch (error) {
      throw wrapDALError(error, "Failed to check if user is on Pro or higher");
    }
  }

  async isUserOnAICoachPlan(userId: string): Promise<boolean> {
    try {
      const plan = await this.getUserPlan(userId);
      return plan === PLAN_NAMES.AI_COACH;
    } catch (error) {
      throw wrapDALError(error, "Failed to check if user is on AI Coach plan");
    }
  }

  async isSubscriptionActive(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      return (
        subscription?.status === "active" || subscription?.status === "trialing"
      );
    } catch (error) {
      throw wrapDALError(error, "Failed to check if subscription is active");
    }
  }

  async getSubscriptionStatus(
    userId: string
  ): Promise<{ plan: string; status: string; isActive: boolean }> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      const plan = subscription?.plan_name || PLAN_NAMES.FREE;
      const status = subscription?.status || "none";
      const isActive =
        subscription?.status === "active" ||
        subscription?.status === "trialing";

      return { plan, status, isActive };
    } catch (error) {
      throw wrapDALError(error, "Failed to get subscription status");
    }
  }

  async createSubscriptionFromStripe(
    userId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    planName: string,
    status: string,
    currentPeriodStart: string,
    currentPeriodEnd: string
  ): Promise<Subscription> {
    try {
      return await this.create({
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan_name: planName,
        status: status as any,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
      });
    } catch (error) {
      throw wrapDALError(error, "Failed to create subscription from Stripe");
    }
  }
}
