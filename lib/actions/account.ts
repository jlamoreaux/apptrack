"use server";

import { createClient } from "../supabase/server";
import { revalidatePath } from "next/cache";
import { stripe } from "../stripe";

export async function deleteAccountAction(formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Get user's subscription to cancel it
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // Cancel Stripe subscription if it exists
    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeError) {
        console.error("Error canceling Stripe subscription:", stripeError);
        // Continue with account deletion even if Stripe cancellation fails
      }
    }

    // Delete all user data
    const tablesToDelete = [
      "usage_tracking",
      "user_subscriptions",
      "linkedin_profiles",
      "application_history",
      "applications",
      "profiles",
    ];

    for (const table of tablesToDelete) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("user_id", user.id);
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
      }
    }

    // Delete the user account
    const { error: deleteError } = await supabase.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Delete account error:", error);
    return { error: "An unexpected error occurred while deleting the account" };
  }
}
