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
      loggerService.warn('Unauthorized promo validation', {
        category: LogCategory.SECURITY,
        action: 'stripe_validate_promo_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { code } = await request.json();

    if (!code) {
      loggerService.warn('Promo validation missing code', {
        category: LogCategory.API,
        userId: user.id,
        action: 'stripe_validate_promo_no_code',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { valid: false, error: "No code provided" },
        { status: 400 }
      );
    }

    const upperCode = code.toUpperCase().trim();
    const supabase = await createClient();

    // First check our database for promo codes
    const { data: promoCode } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", upperCode)
      .eq("active", true)
      .single();

    if (promoCode) {
      // Check if code has expired
      if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
        loggerService.info('Expired promo code validation', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_validate_promo_expired',
          duration: Date.now() - startTime,
          metadata: {
            code: upperCode.slice(0, 4) + '***',
            expiresAt: promoCode.expires_at
          }
        });
        return NextResponse.json({
          valid: false,
          error: "This promo code has expired",
        });
      }

      // Check if code has reached max uses
      if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
        loggerService.info('Promo code at usage limit', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_validate_promo_usage_limit',
          duration: Date.now() - startTime,
          metadata: {
            code: upperCode.slice(0, 4) + '***',
            maxUses: promoCode.max_uses,
            usedCount: promoCode.used_count
          }
        });
        return NextResponse.json({
          valid: false,
          error: "This promo code has reached its usage limit",
        });
      }

      // Handle different code types
      if (promoCode.code_type === "free_forever") {
        loggerService.info('Valid free forever promo code', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_validate_promo_free_forever',
          duration: Date.now() - startTime,
          metadata: {
            code: upperCode.slice(0, 4) + '***'
          }
        });
        return NextResponse.json({
          valid: true,
          code: upperCode,
          description: promoCode.description || "100% off forever (Free plan)",
          type: "free_forever",
          couponId: null,
        });
      } else if (promoCode.code_type === "trial") {
        loggerService.info('Valid trial promo code', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_validate_promo_trial',
          duration: Date.now() - startTime,
          metadata: {
            code: upperCode.slice(0, 4) + '***',
            trialDays: promoCode.trial_days,
            planName: promoCode.plan_name
          }
        });
        return NextResponse.json({
          valid: true,
          code: upperCode,
          description: promoCode.description || `${promoCode.trial_days} day trial for ${promoCode.plan_name}`,
          type: "trial",
          trialDays: promoCode.trial_days,
          planName: promoCode.plan_name,
        });
      } else if (promoCode.code_type === "discount" && promoCode.stripe_coupon_id) {
        // For discount codes, validate with Stripe
        try {
          const coupon = await stripe.coupons.retrieve(promoCode.stripe_coupon_id);
          if (coupon.valid) {
            let discountDescription = promoCode.description || "";
            if (!discountDescription) {
              if (coupon.percent_off) {
                discountDescription = `${coupon.percent_off}% off`;
              } else if (coupon.amount_off) {
                discountDescription = `$${(coupon.amount_off / 100).toFixed(2)} off`;
              }
            }
            
            loggerService.info('Valid discount promo code', {
              category: LogCategory.PAYMENT,
              userId: user.id,
              action: 'stripe_validate_promo_discount',
              duration: Date.now() - startTime,
              metadata: {
                code: upperCode.slice(0, 4) + '***',
                couponId: coupon.id,
                percentOff: coupon.percent_off,
                amountOff: coupon.amount_off
              }
            });
            
            return NextResponse.json({
              valid: true,
              code: upperCode,
              description: discountDescription,
              type: "discount",
              couponId: coupon.id,
            });
          }
        } catch (error) {
          loggerService.error('Error validating Stripe coupon', error, {
            category: LogCategory.PAYMENT,
            userId: user.id,
            action: 'stripe_validate_promo_coupon_error',
            metadata: {
              stripeCouponId: promoCode.stripe_coupon_id
            }
          });
        }
      }
    }

    // Try to find the promotion code
    const promotionCodes = await stripe.promotionCodes.list({
      code: code.toUpperCase(),
      active: true,
      limit: 1,
    });

    if (promotionCodes.data.length > 0) {
      const promoCode = promotionCodes.data[0];
      const coupon = promoCode.coupon;
      
      // Check if the coupon is still valid
      if (coupon.valid) {
        let discountDescription = "";
        
        if (coupon.percent_off) {
          discountDescription = `${coupon.percent_off}% off`;
        } else if (coupon.amount_off) {
          discountDescription = `$${(coupon.amount_off / 100).toFixed(2)} off`;
        }
        
        // Add duration info
        if (coupon.duration === "once") {
          discountDescription += " (first payment)";
        } else if (coupon.duration === "repeating" && coupon.duration_in_months) {
          discountDescription += ` (for ${coupon.duration_in_months} months)`;
        } else if (coupon.duration === "forever") {
          discountDescription += " (forever)";
        }

        loggerService.info('Valid Stripe promotion code', {
          category: LogCategory.PAYMENT,
          userId: user.id,
          action: 'stripe_validate_promo_stripe_valid',
          duration: Date.now() - startTime,
          metadata: {
            code: promoCode.code.slice(0, 4) + '***',
            couponId: coupon.id,
            duration: coupon.duration,
            percentOff: coupon.percent_off,
            amountOff: coupon.amount_off
          }
        });
        
        return NextResponse.json({
          valid: true,
          code: promoCode.code,
          description: discountDescription,
          type: "discount",
          couponId: coupon.id,
        });
      }
    }

    loggerService.info('Invalid promotion code', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_validate_promo_invalid',
      duration: Date.now() - startTime,
      metadata: {
        code: upperCode.slice(0, 4) + '***'
      }
    });
    
    return NextResponse.json({
      valid: false,
      error: "Invalid or expired promotion code",
    });
  } catch (error) {
    loggerService.error('Error validating promotion code', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'stripe_validate_promo_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { valid: false, error: "Failed to validate code" },
      { status: 500 }
    );
  }
}