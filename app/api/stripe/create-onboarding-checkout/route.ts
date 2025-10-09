import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized onboarding checkout attempt', {
        category: LogCategory.SECURITY,
        action: 'stripe_onboarding_checkout_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { planId, billingCycle } = await request.json();

    loggerService.info('Creating onboarding checkout session', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_onboarding_checkout_start',
      metadata: {
        planId,
        billingCycle
      }
    });

    if (!planId || !billingCycle) {
      loggerService.warn('Missing required fields for onboarding checkout', {
        category: LogCategory.API,
        userId: user.id,
        action: 'stripe_onboarding_checkout_missing_fields',
        duration: Date.now() - startTime,
        metadata: {
          hasPlanId: !!planId,
          hasBillingCycle: !!billingCycle
        }
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS },
        { status: 400 }
      );
    }

    // Validate billing cycle
    if (!Object.values(BILLING_CYCLES).includes(billingCycle)) {
      loggerService.warn('Invalid billing cycle for onboarding checkout', {
        category: LogCategory.API,
        userId: user.id,
        action: 'stripe_onboarding_checkout_invalid_cycle',
        duration: Date.now() - startTime,
        metadata: {
          providedCycle: billingCycle
        }
      });
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
      loggerService.warn('Plan not found for onboarding checkout', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_onboarding_checkout_plan_not_found',
        duration: Date.now() - startTime,
        metadata: {
          planId,
          error: planError?.message
        }
      });
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
      loggerService.error('No Stripe price ID configured', new Error('Missing price ID'), {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_onboarding_checkout_no_price',
        duration: Date.now() - startTime,
        metadata: {
          planName: plan.name,
          planId,
          billingCycle
        }
      });
      return NextResponse.json(
        { 
          error: `This plan is not yet configured for ${billingCycle} billing.`,
        },
        { status: 400 }
      );
    }

    loggerService.info('Selected price ID for onboarding checkout', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_onboarding_checkout_price_selected',
      metadata: {
        priceId,
        planName: plan.name,
        billingCycle
      }
    });

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
        loggerService.info('Found existing Stripe customer', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_onboarding_customer_found',
          metadata: {
            stripeCustomerId: customer.id
          }
        });
      } else {
        customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            userId: user.id,
          },
        });
        loggerService.info('Created new Stripe customer', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_onboarding_customer_created',
          metadata: {
            stripeCustomerId: customer.id
          }
        });
      }
    } catch (error) {
      loggerService.error('Error creating/finding Stripe customer', error, {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_onboarding_customer_error'
      });
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
          loggerService.info('Applied onboarding discount', {
            category: LogCategory.PAYMENT,
            userId: user.id,
            action: 'stripe_onboarding_discount_applied',
            metadata: {
              promoCode: promoCode.code,
              promotionCodeId: promotionCodes.data[0].id
            }
          });
        } else {
          // Fallback: apply the coupon directly
          sessionConfig.discounts = [
            {
              coupon: promoCode.stripe_coupon_id,
            },
          ];
          loggerService.info('Applied onboarding coupon directly', {
            category: LogCategory.PAYMENT,
            userId: user.id,
            action: 'stripe_onboarding_coupon_applied',
            metadata: {
              promoCode: promoCode.code,
              stripeCouponId: promoCode.stripe_coupon_id
            }
          });
        }
      } catch (error) {
        loggerService.error('Error applying onboarding discount', error, {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_onboarding_discount_error'
        });
        // Continue without discount if there's an error
      }
    } else {
      loggerService.info('No onboarding discount available', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_onboarding_no_discount'
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    loggerService.info('Onboarding checkout session created', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_onboarding_checkout_created',
      duration: Date.now() - startTime,
      metadata: {
        sessionId: session.id,
        planId,
        planName: plan.name,
        billingCycle,
        hasDiscount: !!sessionConfig.discounts
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    loggerService.error('Error creating onboarding checkout session', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'stripe_onboarding_checkout_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}