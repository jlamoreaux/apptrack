import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { getAudienceMember } from "@/lib/email/audiences";
import { transitionAudience, scheduleDripSequence } from "@/lib/email/drip-scheduler";

/**
 * Unified post-signup endpoint that handles:
 * 1. Stripe customer creation (if not exists)
 * 2. Resend audience membership (if not exists)
 *
 * This endpoint is idempotent - safe to call multiple times.
 * All operations are non-blocking to avoid disrupting the user flow.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized on-signup attempt', {
        category: LogCategory.AUTH,
        action: 'on_signup_unauthorized'
      });

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const results = {
      stripe: { success: false, customerId: null as string | null, message: '' },
      resend: { success: false, message: '' }
    };

    // 1. Handle Stripe customer creation
    try {
      const supabase = await createClient();

      // Check if user already has a Stripe customer ID in their profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      if (profile?.stripe_customer_id) {
        results.stripe = {
          success: true,
          customerId: profile.stripe_customer_id,
          message: 'Customer already exists in profile'
        };
      } else {
        // Check if customer exists in Stripe by email
        const customers = await stripe.customers.list({
          email: user.email!,
          limit: 1,
        });

        let customerId: string;

        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          results.stripe.message = 'Found existing Stripe customer';
        } else {
          // Create new customer
          const customer = await stripe.customers.create({
            email: user.email!,
            name: user.user_metadata?.full_name || user.email!,
            metadata: {
              userId: user.id,
            },
          });
          customerId = customer.id;
          results.stripe.message = 'Created new Stripe customer';

          loggerService.logBusinessMetric(
            'stripe_customer_created',
            1,
            'count',
            { userId: user.id, metadata: { customerId } }
          );
        }

        // Store the customer ID in the user's profile
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id);

        results.stripe = {
          success: true,
          customerId,
          message: results.stripe.message
        };
      }

      loggerService.info('Stripe customer setup complete', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'on_signup_stripe_complete',
        metadata: {
          customerId: results.stripe.customerId,
          message: results.stripe.message
        }
      });

    } catch (stripeError) {
      loggerService.error('Stripe customer setup failed', stripeError as Error, {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'on_signup_stripe_error'
      });
      results.stripe = {
        success: false,
        customerId: null,
        message: 'Failed to setup Stripe customer'
      };
    }

    // 2. Handle Resend audience membership
    if (user.email) {
      try {
        const existingMember = await getAudienceMember(user.email);
        const firstName = user.user_metadata?.full_name?.split(' ')[0];

        if (existingMember && existingMember.current_audience === 'leads') {
          // User was captured as a lead (e.g., resume roast) - transition to free-users
          await transitionAudience(user.email, 'leads', 'free-users', {
            userId: user.id,
            firstName,
          });

          results.resend = {
            success: true,
            message: 'Transitioned from leads to free-users'
          };

          loggerService.logBusinessMetric(
            'audience_member_transitioned',
            1,
            'count',
            { userId: user.id, metadata: { fromAudience: 'leads', toAudience: 'free-users' } }
          );
        } else if (existingMember) {
          // Already in free-users, trial-users, or paid-users - no action needed
          results.resend = {
            success: true,
            message: `Already in audience: ${existingMember.current_audience}`
          };
        } else {
          // New user - add to free-users
          await scheduleDripSequence({
            email: user.email,
            audience: 'free-users',
            userId: user.id,
            firstName,
            metadata: { source: 'signup' },
          });

          results.resend = {
            success: true,
            message: 'Added to free-users audience'
          };

          loggerService.logBusinessMetric(
            'audience_member_added',
            1,
            'count',
            { userId: user.id, metadata: { audience: 'free-users' } }
          );
        }

        loggerService.info('Resend audience setup complete', {
          category: LogCategory.EMAIL,
          userId: user.id,
          action: 'on_signup_resend_complete',
          metadata: { message: results.resend.message }
        });

      } catch (resendError) {
        loggerService.error('Resend audience setup failed', resendError as Error, {
          category: LogCategory.EMAIL,
          userId: user.id,
          action: 'on_signup_resend_error'
        });
        results.resend = {
          success: false,
          message: 'Failed to setup Resend audience'
        };
      }
    }

    loggerService.info('On-signup processing complete', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'on_signup_complete',
      duration: Date.now() - startTime,
      metadata: {
        stripeSuccess: results.stripe.success,
        resendSuccess: results.resend.success
      }
    });

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    loggerService.error('On-signup processing failed', error as Error, {
      category: LogCategory.AUTH,
      action: 'on_signup_error',
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { error: "Failed to complete signup setup" },
      { status: 500 }
    );
  }
}
