import { createClient } from "@/lib/supabase/server";

/**
 * Admin service for managing admin users and permissions
 */
export class AdminService {
  /**
   * Check if a user is an admin
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (error) {
        console.error("Admin check error:", error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  /**
   * Get all admin users
   */
  static async getAdminUsers(): Promise<Array<{ user_id: string; created_at: string; notes?: string }>> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching admin users:", error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return [];
    }
  }

  /**
   * Add a new admin user
   */
  static async addAdminUser(userId: string, notes?: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("admin_users")
        .insert({
          user_id: userId,
          notes: notes || null,
        });
      
      if (error) {
        console.error("Error adding admin user:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error adding admin user:", error);
      return false;
    }
  }

  /**
   * Remove an admin user
   */
  static async removeAdminUser(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("admin_users")
        .delete()
        .eq("user_id", userId);
      
      if (error) {
        console.error("Error removing admin user:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error removing admin user:", error);
      return false;
    }
  }
}

// List of admin user IDs for fallback/emergency access
// This can be used if the database is unavailable
export const FALLBACK_ADMIN_IDS = [
  "07de3fb9-2062-4a83-b0c3-c7bf94dbcbab", // Initial admin user
];