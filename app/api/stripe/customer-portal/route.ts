import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUser, createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch the Stripe customer ID from user_subscriptions
  const supabase = await createClient();
  const { data: subscription, error } = await supabase
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (error || !subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer ID found" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${request.headers.get("origin")}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    if (err?.code === "resource_missing" && err?.param === "customer") {
      return NextResponse.json(
        {
          error:
            "Your billing account could not be found in Stripe. Please contact support or try re-subscribing.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
