import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized promo code check', {
        category: LogCategory.SECURITY,
        action: 'promo_code_check_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      loggerService.warn('Promo code check missing code', {
        category: LogCategory.API,
        userId: user.id,
        action: 'promo_code_check_missing_code',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if the promo code exists and is valid
    const { data: promoCode, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("active", true)
      .single();

    if (promoError || !promoCode) {
      loggerService.warn('Invalid promo code checked', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'promo_code_check_invalid',
        duration: Date.now() - startTime,
        metadata: {
          code: code?.slice(0, 4) + '***',
          error: promoError?.message
        }
      });
      return NextResponse.json(
        { error: "Invalid or expired promo code" },
        { status: 404 }
      );
    }

    // Check if code has expired
    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      loggerService.warn('Expired promo code checked', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'promo_code_check_expired',
        duration: Date.now() - startTime,
        metadata: {
          code: code?.slice(0, 4) + '***',
          expiresAt: promoCode.expires_at
        }
      });
      return NextResponse.json(
        { error: "This promo code has expired" },
        { status: 400 }
      );
    }

    // Check usage limits
    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
      loggerService.warn('Promo code usage limit reached', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'promo_code_check_usage_limit',
        duration: Date.now() - startTime,
        metadata: {
          code: code?.slice(0, 4) + '***',
          maxUses: promoCode.max_uses,
          usedCount: promoCode.used_count
        }
      });
      return NextResponse.json(
        { error: "This promo code has reached its usage limit" },
        { status: 400 }
      );
    }

    // Check if user has already used this code
    const { data: existingUsage } = await supabase
      .from("promo_code_usage")
      .select("*")
      .eq("promo_code_id", promoCode.id)
      .eq("user_id", user.id)
      .single();

    if (existingUsage) {
      loggerService.warn('User already used promo code', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'promo_code_check_already_used',
        duration: Date.now() - startTime,
        metadata: {
          code: code?.slice(0, 4) + '***'
        }
      });
      return NextResponse.json(
        { error: "You have already used this promo code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        code_type: promoCode.code_type,
        discount_percent: promoCode.discount_percent,
        stripe_promo_code_id: promoCode.stripe_promo_code_id,
        trial_days: promoCode.trial_days,
        plan_names: promoCode.plan_names,
      },
    });
    
    loggerService.info('Promo code validated successfully', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'promo_code_check_success',
      duration: Date.now() - startTime,
      metadata: {
        code: code?.slice(0, 4) + '***',
        codeType: promoCode.code_type,
        discountPercent: promoCode.discount_percent,
        trialDays: promoCode.trial_days
      }
    });
  } catch (error) {
    loggerService.error('Error checking promo code', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'promo_code_check_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to check promo code" },
      { status: 500 }
    );
  }
}