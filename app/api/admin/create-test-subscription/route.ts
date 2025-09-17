import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscriptions";
import { stripe } from "@/lib/stripe";

// Admin endpoint to create test subscriptions
// Protect this endpoint in production!
export async function POST(request: NextRequest) {
  try {
    const { userId, planId } = await request.json();
    
    // TODO: Add admin authentication check here
    // if (!isAdmin) return unauthorized response
    
    const supabase = await createClient();
    
    // Get AI Coach plan
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId || "ai-coach-plan-id") // Replace with actual AI Coach plan ID
      .single();
      
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    
    // Create a test subscription in Stripe with 100% coupon
    const subscription = await stripe.subscriptions.create({
      customer: await getOrCreateTestCustomer(userId),
      items: [{ price: plan.stripe_monthly_price_id }],
      coupon: "100_PERCENT_OFF", // Create this coupon in Stripe first
      metadata: {
        userId,
        planId: plan.id,
        billingCycle: "monthly",
      },
    });
    
    // Create subscription in database
    const subscriptionService = new SubscriptionService();
    await subscriptionService.createSubscriptionFromStripe(
      userId,
      subscription.customer as string,
      subscription.id,
      plan.id,
      "active",
      new Date().toISOString(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      "monthly"
    );
    
    return NextResponse.json({ 
      success: true, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    console.error("Error creating test subscription:", error);
    return NextResponse.json(
      { error: "Failed to create test subscription" },
      { status: 500 }
    );
  }
}

async function getOrCreateTestCustomer(userId: string): Promise<string> {
  const supabase = await createClient();
  
  // Get user email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
    
  if (!profile?.email) throw new Error("User email not found");
  
  // Check for existing customer
  const customers = await stripe.customers.list({
    email: profile.email,
    limit: 1,
  });
  
  if (customers.data.length > 0) {
    return customers.data[0].id;
  }
  
  // Create new test customer
  const customer = await stripe.customers.create({
    email: profile.email,
    metadata: { userId, testAccount: "true" },
  });
  
  return customer.id;
}