"use server";

import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin-client";
import { revalidatePath } from "next/cache";
import { stripe } from "../stripe";
import { AuditAction, EntityType } from "../services/audit.service";

export async function deleteAccountAction(formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Capture user info BEFORE deletion for audit log
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const userEmail = profile?.email || user.email || "unknown";
    const userName = profile?.full_name || "unknown";

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
      }
    }

    // Create audit log entry BEFORE deleting the user
    // (FK constraint removed in migration 009 to allow logs to persist)
    const adminClient = createAdminClient();
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      user_email: userEmail,
      user_name: userName,
      action: AuditAction.USER_DELETED,
      entity_type: EntityType.USER,
      entity_id: user.id,
      old_values: {
        email: userEmail,
        name: userName,
        had_subscription: !!subscription?.stripe_subscription_id,
      },
      metadata: {
        deleted_at: new Date().toISOString(),
        self_service: true,
      },
    });

    // Delete the user account using admin client (requires service role key)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: "An unexpected error occurred while deleting the account" };
  }
}
