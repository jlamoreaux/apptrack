import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface UserSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  billing_cycle: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  subscription_plans: {
    name: string;
    price_monthly: number | null;
    price_yearly: number | null;
  } | null;
}

export interface UserWithSubscription extends UserProfile {
  user_subscriptions?: any[];
}

export interface AdminUser {
  user_id: string;
  created_at: string;
  notes?: string | null;
}

export class UsersDAL {
  /**
   * Get all user profiles with their subscription information
   * Uses admin client to bypass RLS
   */
  static async getAllUsersWithSubscriptions(): Promise<UserWithSubscription[]> {
    // Use admin client to bypass RLS and see all users
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        created_at,
        user_subscriptions (
          id,
          status,
          billing_cycle,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          subscription_plans (
            name,
            price_monthly,
            price_yearly
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users with subscriptions:", error);
      throw new Error("Failed to fetch users");
    }

    return data || [];
  }

  /**
   * Get all admin users
   * Uses admin client to bypass RLS
   */
  static async getAdminUsers(): Promise<AdminUser[]> {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching admin users:", error);
      throw new Error("Failed to fetch admin users");
    }
    
    return data || [];
  }

  /**
   * Check if a user is an admin
   */
  static async isAdmin(userId: string): Promise<boolean> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
    
    return !!data;
  }

  /**
   * Add a new admin user
   */
  static async addAdminUser(userId: string, notes?: string): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from("admin_users")
      .insert({
        user_id: userId,
        notes: notes || null,
      });
    
    if (error) {
      console.error("Error adding admin user:", error);
      throw new Error("Failed to add admin user");
    }
  }

  /**
   * Remove an admin user
   */
  static async removeAdminUser(userId: string): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from("admin_users")
      .delete()
      .eq("user_id", userId);
    
    if (error) {
      console.error("Error removing admin user:", error);
      throw new Error("Failed to remove admin user");
    }
  }

  /**
   * Get user count
   * Uses admin client to bypass RLS
   */
  static async getUserCount(): Promise<number> {
    const supabase = createAdminClient();
    
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: 'exact', head: true });
    
    if (error) {
      console.error("Error getting user count:", error);
      return 0;
    }
    
    return count || 0;
  }

  /**
   * Get users created after a specific date
   * Uses admin client to bypass RLS
   */
  static async getUsersCreatedAfter(date: Date): Promise<number> {
    const supabase = createAdminClient();
    
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: 'exact', head: true })
      .gte("created_at", date.toISOString());
    
    if (error) {
      console.error("Error getting new users count:", error);
      return 0;
    }
    
    return count || 0;
  }

  /**
   * Get subscription statistics
   * Uses admin client to bypass RLS
   */
  static async getSubscriptionStats(): Promise<Record<string, number>> {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("status")
      .in("status", ['active', 'trialing', 'past_due', 'canceled']);
    
    if (error) {
      console.error("Error getting subscription stats:", error);
      return {};
    }
    
    return data?.reduce((acc: Record<string, number>, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {}) || {};
  }
}