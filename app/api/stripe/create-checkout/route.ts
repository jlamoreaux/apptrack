import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized checkout attempt', {
        category: LogCategory.PAYMENT,
        action: 'checkout_unauthorized'
      });
      
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { planId, billingCycle, promoCode, couponId, discountCode, trialDays } = await request.json();

    loggerService.info('Creating checkout session', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'checkout_create_start',
      metadata: {
        planId,
        billingCycle,
        hasPromoCode: !!promoCode,
        hasCouponId: !!couponId,
        hasDiscountCode: !!discountCode,
        trialDays
      }
    });

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

    // Prevent new Pro subscriptions (only grandfathered users can keep Pro)
    if (plan.name === "Pro") {
      loggerService.warn('Attempted to create new Pro subscription', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'checkout_pro_plan_blocked',
        metadata: {
          planId,
          planName: plan.name
        }
      });
      
      return NextResponse.json(
        { 
          error: "The Pro plan is no longer available for new subscriptions. Please choose the AI Coach plan instead.",
          suggestedPlan: "AI Coach"
        },
        { status: 400 }
      );
    }

    // Determine the price ID based on billing cycle
    const priceId =
      billingCycle === BILLING_CYCLES.YEARLY
        ? plan.stripe_yearly_price_id
        : plan.stripe_monthly_price_id;

    if (!priceId) {
      loggerService.error('No Stripe price ID found', new Error('Missing price ID'), {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'checkout_missing_price_id',
        metadata: {
          planName: plan.name,
          planId,
          billingCycle,
          monthlyPriceId: plan.stripe_monthly_price_id,
          yearlyPriceId: plan.stripe_yearly_price_id
        }
      });
      
      return NextResponse.json(
        { 
          error: `This plan is not yet configured for ${billingCycle} billing. Please contact support or try a different billing cycle.`,
          details: `Missing Stripe price ID for ${plan.name} plan (${billingCycle})`
        },
        { status: 400 }
      );
    }

    loggerService.debug('Using price ID for checkout', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'checkout_price_selected',
      metadata: {
        priceId,
        planName: plan.name,
        billingCycle
      }
    });

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

    // Create checkout session with optional promo code
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
    };
    
    // Add trial period if specified
    if (trialDays && trialDays > 0) {
      sessionParams.subscription_data.trial_period_days = trialDays;
      
      loggerService.info('Adding trial period to checkout', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'checkout_trial_added',
        metadata: {
          trialDays,
          planName: plan.name
        }
      });
    }
    
    // Only add allow_promotion_codes if we don't have any discount
    if (!promoCode && !couponId && !discountCode) {
      sessionParams.allow_promotion_codes = true;
    }

    // Handle legacy discount code parameter
    if (discountCode && !promoCode && !couponId) {
      try {
        // First, try to find the promotion code
        const promotionCodes = await stripe.promotionCodes.list({
          code: discountCode,
          active: true,
          limit: 1,
        });

        if (promotionCodes.data.length > 0) {
          // Apply the coupon associated with the promotion code
          const promoCodeData = promotionCodes.data[0];
          sessionParams.discounts = [
            {
              promotion_code: promoCodeData.id,
            },
          ];
          loggerService.debug('Applied promotion code', {
            category: LogCategory.PAYMENT,
            userId: user.id,
            action: 'checkout_promo_applied',
            metadata: {
              discountCode,
              promoCodeId: promoCodeData.id
            }
          });
        } else {
          // If no promotion code found, still allow promotion codes to be entered
          sessionParams.allow_promotion_codes = true;
          loggerService.debug('Promotion code not found', {
            category: LogCategory.PAYMENT,
            userId: user.id,
            action: 'checkout_promo_not_found',
            metadata: {
              discountCode
            }
          });
        }
      } catch (error) {
        loggerService.error('Error applying promotion code', error, {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'checkout_promo_error',
          metadata: {
            discountCode
          }
        });
        // Fallback to allowing promotion codes
        sessionParams.allow_promotion_codes = true;
      }
    }

    // If we have a promo code or coupon, add it as a discount
    if (promoCode) {
      loggerService.debug('Applying promotion code to checkout', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'checkout_promo_direct',
        metadata: {
          promoCode
        }
      });
      sessionParams.discounts = [
        {
          promotion_code: promoCode,
        },
      ];
    } else if (couponId) {
      loggerService.debug('Applying coupon to checkout', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'checkout_coupon_applied',
        metadata: {
          couponId
        }
      });
      sessionParams.discounts = [
        {
          coupon: couponId,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    loggerService.info('Checkout session created successfully', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'checkout_session_created',
      duration: Date.now() - startTime,
      metadata: {
        sessionId: session.id,
        planId,
        billingCycle,
        amount: session.amount_total,
        currency: session.currency
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    loggerService.error('Error creating checkout session', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'checkout_session_error',
      duration: Date.now() - startTime,
      metadata: {
        planId,
        billingCycle
      }
    });
    
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
