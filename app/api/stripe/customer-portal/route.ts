import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUser, createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const user = await getUser();
  if (!user) {
    loggerService.warn('Unauthorized customer portal access', {
      category: LogCategory.SECURITY,
      action: 'stripe_customer_portal_unauthorized',
      duration: Date.now() - startTime
    });
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
    loggerService.warn('No Stripe customer ID for portal', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_customer_portal_no_customer',
      duration: Date.now() - startTime,
      metadata: {
        error: error?.message
      }
    });
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
    
    loggerService.info('Customer portal session created', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_customer_portal_created',
      duration: Date.now() - startTime,
      metadata: {
        stripeCustomerId: subscription.stripe_customer_id,
        sessionId: session.id
      }
    });
    
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    if (err?.code === "resource_missing" && err?.param === "customer") {
      loggerService.error('Stripe customer missing', err, {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_customer_portal_customer_missing',
        duration: Date.now() - startTime,
        metadata: {
          stripeCustomerId: subscription?.stripe_customer_id
        }
      });
      return NextResponse.json(
        {
          error:
            "Your billing account could not be found in Stripe. Please contact support or try re-subscribing.",
        },
        { status: 400 }
      );
    }
    
    loggerService.error('Customer portal error', err, {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_customer_portal_error',
      duration: Date.now() - startTime,
      metadata: {
        errorCode: err?.code,
        errorParam: err?.param
      }
    });
    
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
