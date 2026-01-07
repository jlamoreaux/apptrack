import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized customer creation attempt', {
        category: LogCategory.PAYMENT,
        action: 'create_customer_unauthorized'
      });

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if customer already exists
    const customers = await stripe.customers.list({
      email: user.email!,
      limit: 1,
    });

    if (customers.data.length > 0) {
      loggerService.info('Customer already exists', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'create_customer_exists',
        metadata: {
          customerId: customers.data[0].id
        }
      });

      // Update the user's profile with the stripe customer ID if not already set
      const supabase = await createClient();
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customers.data[0].id })
        .eq("id", user.id);

      return NextResponse.json({
        success: true,
        customerId: customers.data[0].id,
        message: "Customer already exists"
      });
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: user.email!,
      name: user.user_metadata?.full_name || user.email!,
      metadata: {
        userId: user.id,
      },
    });

    loggerService.info('Created new Stripe customer', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'create_customer_success',
      duration: Date.now() - startTime,
      metadata: {
        customerId: customer.id
      }
    });

    // Store the customer ID in the user's profile
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("id", user.id);

    loggerService.logBusinessMetric(
      'stripe_customer_created',
      1,
      'count',
      {
        userId: user.id,
        customerId: customer.id
      }
    );

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      message: "Customer created successfully"
    });

  } catch (error) {
    loggerService.error('Error creating Stripe customer', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'create_customer_error',
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
