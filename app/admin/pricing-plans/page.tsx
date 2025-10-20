import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { PricingPlansAdmin } from "./pricing-plans-admin";
import { createClient } from "@/lib/supabase/server-client";

async function getSubscriptionPlans() {
  const supabase = await createClient();
  
  const { data: plans, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("price_monthly", { ascending: true });

  if (error) {
    console.error("Failed to fetch subscription plans:", error);
    return [];
  }

  return plans || [];
}

export default async function AdminPricingPlansPage() {
  const user = await getUser();

  if (!user) {
    notFound();
  }

  const isAdmin = await AdminService.isAdmin(user.id);

  if (!isAdmin) {
    notFound();
  }

  const plans = await getSubscriptionPlans();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pricing Plans Management</h1>
        <p className="text-muted-foreground">
          Manage subscription plan features and pricing displayed on the website
        </p>
      </div>

      <PricingPlansAdmin initialPlans={plans} />
    </>
  );
}