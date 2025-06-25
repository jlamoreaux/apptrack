import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { planId, billingCycle } = await request.json();

    console.log(
      `Creating checkout for user ${user.id}, plan ${planId}, billing ${billingCycle}`
    );

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS },
        { status: 400 }
      );
    }

    // Validate billing cycle
    if (!Object.values(BILLING_CYCLES).includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billing cycle" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Determine the price ID based on billing cycle
    const priceId =
      billingCycle === BILLING_CYCLES.YEARLY
        ? plan.stripe_yearly_price_id
        : plan.stripe_monthly_price_id;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not found for billing cycle" },
        { status: 400 }
      );
    }

    console.log(`Using price ID: ${priceId}`);

    // Create or get customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: user.email!,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
        console.log(`Found existing customer: ${customer.id}`);
      } else {
        customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            userId: user.id,
          },
        });
        console.log(`Created new customer: ${customer.id}`);
      }
    } catch (error) {
      console.error("Error creating/finding customer:", error);
      return NextResponse.json(
        { error: "Error creating customer" },
        { status: 500 }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${request.headers.get(
        "origin"
      )}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get("origin")}/dashboard/upgrade`,
      metadata: {
        userId: user.id,
        planId: planId,
        billingCycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId: planId,
          billingCycle: billingCycle,
        },
      },
    });

    console.log(`Created checkout session: ${session.id}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
