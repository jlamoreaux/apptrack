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
import type { SupabaseClient } from "@supabase/supabase-js";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export class SubscriptionService
  implements
    BaseService<Subscription, CreateSubscriptionInput, UpdateSubscriptionInput>
{
  private subscriptionDAL: SubscriptionDAL;

  constructor(supabaseClient?: SupabaseClient) {
    this.subscriptionDAL = new SubscriptionDAL(supabaseClient);
  }

  async create(data: CreateSubscriptionInput): Promise<Subscription> {
    const startTime = Date.now();
    
    try {
      // Validate required fields
      if (!data.user_id?.trim()) {
        loggerService.warn('Invalid user ID for subscription creation', {
          category: LogCategory.PAYMENT,
          action: 'subscription_create_invalid_user'
        });
        throw new ValidationServiceError("User ID is required");
      }

      if (!data.plan_id?.trim()) {
        loggerService.warn('Invalid plan ID for subscription creation', {
          category: LogCategory.PAYMENT,
          userId: data.user_id,
          action: 'subscription_create_invalid_plan'
        });
        throw new ValidationServiceError("Plan ID is required");
      }

      // Validate dates
      if (data.current_period_start && data.current_period_end) {
        const startDate = new Date(data.current_period_start);
        const endDate = new Date(data.current_period_end);

        if (startDate >= endDate) {
          loggerService.warn('Invalid subscription period dates', {
            category: LogCategory.PAYMENT,
            userId: data.user_id,
            action: 'subscription_create_invalid_dates',
            metadata: {
              start: data.current_period_start,
              end: data.current_period_end
            }
          });
          throw new ValidationServiceError(
            "Current period start must be before current period end"
          );
        }
      }

      const subscription = await this.subscriptionDAL.create(data);
      
      loggerService.logPaymentEvent(
        'subscription_created',
        undefined,
        undefined,
        undefined,
        {
          userId: data.user_id,
          metadata: {
            subscriptionId: subscription.id,
            planId: data.plan_id,
            stripeSubscriptionId: data.stripe_subscription_id,
            status: data.status
          }
        }
      );
      
      loggerService.logBusinessMetric(
        'subscription_created',
        1,
        'count',
        {
          userId: data.user_id,
          metadata: {
            planId: data.plan_id,
            status: data.status
          }
        }
      );
      
      return subscription;
    } catch (error) {
      loggerService.error('Failed to create subscription', error, {
        category: LogCategory.PAYMENT,
        userId: data.user_id,
        action: 'subscription_create_error',
        duration: Date.now() - startTime,
        metadata: {
          planId: data.plan_id
        }
      });
      
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
    const startTime = Date.now();
    
    try {
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
        loggerService.warn('Subscription not found for update', {
          category: LogCategory.PAYMENT,
          action: 'subscription_update_not_found',
          metadata: { subscriptionId: id }
        });
        throw new NotFoundServiceError("Subscription", id);
      }

      // Log status changes
      if (data.status) {
        loggerService.logPaymentEvent(
          'subscription_updated',
          undefined,
          undefined,
          undefined,
          {
            userId: subscription.user_id,
            metadata: {
              subscriptionId: id,
              newStatus: data.status,
              updatedFields: Object.keys(data)
            }
          }
        );
        
        // Log specific business events for important status changes
        if (data.status === 'cancelled' || data.status === 'canceled') {
          loggerService.logBusinessMetric(
            'subscription_cancelled',
            1,
            'count',
            {
              userId: subscription.user_id,
              metadata: {
                subscriptionId: id,
                planId: subscription.plan_id
              }
            }
          );
        }
      }

      return subscription;
    } catch (error) {
      loggerService.error('Failed to update subscription', error, {
        category: LogCategory.PAYMENT,
        action: 'subscription_update_error',
        duration: Date.now() - startTime,
        metadata: {
          subscriptionId: id,
          updatedFields: Object.keys(data)
        }
      });
      
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
    const startTime = Date.now();
    
    try {
      const subscription = await this.subscriptionDAL.getActiveSubscription(userId);
      
      loggerService.debug('Retrieved active subscription', {
        category: LogCategory.BUSINESS,
        userId,
        action: 'get_active_subscription',
        duration: Date.now() - startTime,
        metadata: {
          hasActiveSubscription: !!subscription,
          subscriptionId: subscription?.id,
          planId: subscription?.plan_id,
          status: subscription?.status
        }
      });
      
      return subscription;
    } catch (error) {
      loggerService.error('Failed to get active subscription', error, {
        category: LogCategory.BUSINESS,
        userId,
        action: 'get_active_subscription_error',
        duration: Date.now() - startTime
      });
      
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
      const subscription =
        await this.subscriptionDAL.getSubscriptionWithPlanName(userId);
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
      const subscription =
        await this.subscriptionDAL.getSubscriptionWithPlanName(userId);
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
    planId: string,
    status: string,
    currentPeriodStart: string,
    currentPeriodEnd: string,
    billingCycle: "monthly" | "yearly" = "monthly"
  ): Promise<Subscription> {
    try {

      const result = await this.create({
        user_id: userId,
        plan_id: planId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status: status as any,
        billing_cycle: billingCycle,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
      });

      return result;
    } catch (error) {
      throw wrapDALError(error, "Failed to create subscription from Stripe");
    }
  }
}
