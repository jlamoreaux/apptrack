import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
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
      `Creating onboarding checkout for user ${user.id}, plan ${planId}, billing ${billingCycle}`
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

    // Get the onboarding discount code from database
    const { data: promoCode } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", "WELCOME20")
      .eq("active", true)
      .single();

    // Determine the price ID based on billing cycle
    const priceId =
      billingCycle === BILLING_CYCLES.YEARLY
        ? plan.stripe_yearly_price_id
        : plan.stripe_monthly_price_id;

    if (!priceId) {
      console.error(
        `No Stripe price ID found for plan ${plan.name} (${planId}) with billing cycle ${billingCycle}`
      );
      return NextResponse.json(
        { 
          error: `This plan is not yet configured for ${billingCycle} billing.`,
        },
        { status: 400 }
      );
    }

    console.log(`Using price ID: ${priceId} for ${plan.name} (${billingCycle})`);

    // Create or get customer
    let customer;
    try {
      // Check if customer already exists
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

    // Build checkout session configuration
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
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
      )}/dashboard?upgrade_success=true&message=${encodeURIComponent(
        `Welcome! You've successfully upgraded to ${plan.name} with 20% off for 3 months!`
      )}`,
      cancel_url: `${request.headers.get("origin")}/dashboard/upgrade`,
      metadata: {
        userId: user.id,
        planId: planId,
        billingCycle: billingCycle,
        onboarding: "true",
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId: planId,
          billingCycle: billingCycle,
          onboarding: "true",
        },
      },
    };

    // Apply the onboarding discount if found
    if (promoCode && promoCode.stripe_coupon_id) {
      // Try to find the Stripe promotion code
      try {
        const promotionCodes = await stripe.promotionCodes.list({
          coupon: promoCode.stripe_coupon_id,
          active: true,
          limit: 1,
        });

        if (promotionCodes.data.length > 0) {
          sessionConfig.discounts = [
            {
              promotion_code: promotionCodes.data[0].id,
            },
          ];
          console.log(`Applied onboarding discount: ${promoCode.code}`);
        } else {
          // Fallback: apply the coupon directly
          sessionConfig.discounts = [
            {
              coupon: promoCode.stripe_coupon_id,
            },
          ];
          console.log(`Applied onboarding coupon directly: ${promoCode.stripe_coupon_id}`);
        }
      } catch (error) {
        console.error("Error applying onboarding discount:", error);
        // Continue without discount if there's an error
      }
    } else {
      console.log("No onboarding discount found or configured");
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log(`Created onboarding checkout session: ${session.id}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating onboarding checkout session:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}