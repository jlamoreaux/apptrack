import { UsersDAL, type UserWithSubscription } from "@/lib/dal/users.dal";

/**
 * Admin service for managing admin users and permissions
 */
export class AdminService {
  /**
   * Check if a user is an admin
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      return await UsersDAL.isAdmin(userId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all admin users
   */
  static async getAdminUsers() {
    try {
      return await UsersDAL.getAdminUsers();
    } catch (error) {
      return [];
    }
  }

  /**
   * Add a new admin user
   */
  static async addAdminUser(userId: string, notes?: string): Promise<boolean> {
    try {
      await UsersDAL.addAdminUser(userId, notes);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove an admin user
   */
  static async removeAdminUser(userId: string): Promise<boolean> {
    try {
      await UsersDAL.removeAdminUser(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all users with their subscription information
   */
  static async getAllUsersWithSubscriptions() {
    try {
      const users = await UsersDAL.getAllUsersWithSubscriptions();
      const adminUsers = await UsersDAL.getAdminUsers();
      
      const adminUserIds = new Set(adminUsers.map(a => a.user_id));

      // Map the data to include admin status and format subscription info
      const mappedUsers = users.map(user => {
        const activeSubscription = user.user_subscriptions?.find(
          sub => sub.status === 'active' || sub.status === 'trialing'
        );

        return {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at,
          is_admin: adminUserIds.has(user.id),
          subscription: activeSubscription ? {
            status: activeSubscription.status,
            billing_cycle: activeSubscription.billing_cycle,
            current_period_end: activeSubscription.current_period_end,
            cancel_at_period_end: activeSubscription.cancel_at_period_end,
            plan_name: activeSubscription.subscription_plans?.name || 'Unknown Plan',
            price: activeSubscription.billing_cycle === 'yearly' 
              ? activeSubscription.subscription_plans?.price_yearly 
              : activeSubscription.subscription_plans?.price_monthly
          } : null
        };
      });

      return mappedUsers;
    } catch (error) {
      console.error("Error in getAllUsersWithSubscriptions:", error);
      return [];
    }
  }

  /**
   * Get user statistics for the admin dashboard
   */
  static async getUserStats() {
    try {
      const totalUsers = await UsersDAL.getUserCount();
      const statsByStatus = await UsersDAL.getSubscriptionStats();
      
      // Get users created in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newUsers = await UsersDAL.getUsersCreatedAfter(thirtyDaysAgo);

      return {
        totalUsers,
        activeSubscriptions: statsByStatus.active || 0,
        trialUsers: statsByStatus.trialing || 0,
        pastDueUsers: statsByStatus.past_due || 0,
        canceledUsers: statsByStatus.canceled || 0,
        newUsersLast30Days: newUsers
      };
    } catch (error) {
      console.error("Error getting user stats:", error);
      return {
        totalUsers: 0,
        activeSubscriptions: 0,
        trialUsers: 0,
        pastDueUsers: 0,
        canceledUsers: 0,
        newUsersLast30Days: 0
      };
    }
  }
}

// List of admin user IDs for fallback/emergency access
// This can be used if the database is unavailable
export const FALLBACK_ADMIN_IDS = [
  "07de3fb9-2062-4a83-b0c3-c7bf94dbcbab", // Initial admin user
];