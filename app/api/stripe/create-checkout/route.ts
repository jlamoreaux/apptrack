import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, billingCycle } = await request.json();

    console.log(
      `Creating checkout for user ${user.id}, plan ${planId}, billing ${billingCycle}`
    );

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: "Plan ID and billing cycle are required" },
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
      billingCycle === "yearly"
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
      { error: "Error creating checkout session" },
      { status: 500 }
    );
  }
}
