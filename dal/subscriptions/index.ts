import { createClient } from "@/lib/supabase/server";
import { BaseDAL, DALError, NotFoundError, ValidationError } from "../base";
import type { Subscription } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CreateSubscriptionInput {
  user_id: string;
  plan_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface UpdateSubscriptionInput {
  plan_id?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status?: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
  billing_cycle?: "monthly" | "yearly";
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
}

export class SubscriptionDAL
  implements
    BaseDAL<Subscription, CreateSubscriptionInput, UpdateSubscriptionInput>
{
  private supabaseClient?: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }
  async create(data: CreateSubscriptionInput): Promise<Subscription> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create subscription: ${error.message}`
        );
      }

      return subscription;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to create subscription",
        "CREATE_ERROR",
        error
      );
    }
  }

  async findById(id: string): Promise<Subscription | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find subscription: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find subscription", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find subscriptions: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find subscriptions", "QUERY_ERROR", error);
    }
  }

  async update(
    id: string,
    data: UpdateSubscriptionInput
  ): Promise<Subscription | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data: updatedSubscription, error } = await supabase
        .from("user_subscriptions")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update subscription: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedSubscription;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update subscription",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { error } = await supabase
        .from("user_subscriptions")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete subscription: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to delete subscription",
        "DELETE_ERROR",
        error
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check subscription existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check subscription existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      let query = supabase
        .from("user_subscriptions")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count subscriptions: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to count subscriptions", "QUERY_ERROR", error);
    }
  }

  // Subscription-specific methods
  async getActiveSubscription(userId: string): Promise<Subscription | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to get active subscription: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to get active subscription",
        "QUERY_ERROR",
        error
      );
    }
  }

  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to get current subscription: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to get current subscription",
        "QUERY_ERROR",
        error
      );
    }
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string
  ): Promise<Subscription | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find subscription by Stripe ID: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find subscription by Stripe ID",
        "QUERY_ERROR",
        error
      );
    }
  }

  async findByStripeCustomerId(
    stripeCustomerId: string
  ): Promise<Subscription[]> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("stripe_customer_id", stripeCustomerId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find subscriptions by Stripe customer ID: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find subscriptions by Stripe customer ID",
        "QUERY_ERROR",
        error
      );
    }
  }

  async cancelSubscription(id: string): Promise<Subscription | null> {
    return this.update(id, {
      cancel_at_period_end: true,
    });
  }

  async reactivateSubscription(id: string): Promise<Subscription | null> {
    return this.update(id, {
      status: "active",
      cancel_at_period_end: false,
    });
  }

  async updateFromStripeWebhook(
    stripeSubscriptionId: string,
    data: Partial<UpdateSubscriptionInput>
  ): Promise<Subscription | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data: updatedSubscription, error } = await supabase
        .from("user_subscriptions")
        .update(data)
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update subscription from webhook: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedSubscription;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update subscription from webhook",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async getPlanName(planId: string): Promise<string | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("name")
        .eq("id", planId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to get plan name: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data?.name || null;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to get plan name", "QUERY_ERROR", error);
    }
  }

  async getSubscriptionWithPlanName(
    userId: string
  ): Promise<(Subscription & { plan_name: string }) | null> {
    try {
      const supabase = this.supabaseClient ?? await createClient();
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(
          `
          *,
          subscription_plans!inner(name)
        `
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to get subscription with plan name: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      if (!data) return null;

      return {
        ...data,
        plan_name: data.subscription_plans?.name || "Free",
      };
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to get subscription with plan name",
        "QUERY_ERROR",
        error
      );
    }
  }
}
