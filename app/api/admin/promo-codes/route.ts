import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { AdminService } from "@/lib/services/admin.service";
import { AuditService } from "@/lib/services/audit.service";

// GET /api/admin/promo-codes - List all promo codes
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Use admin client for admin operations
    // Admin endpoints need full access to create/update/delete promo codes
    const supabase = createAdminClient();
    
    const { data: promoCodes, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ promoCodes: promoCodes || [] });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json(
      { error: "Failed to fetch promo codes", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/promo-codes - Create new promo code
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const {
      code,
      description,
      code_type = "trial",
      codeType, // backwards compatibility
      trial_days = 90,
      trialDays, // backwards compatibility
      plan_name = "AI Coach",
      planName, // backwards compatibility
      applicable_plans,
      applicablePlans, // backwards compatibility
      max_uses,
      maxUses, // backwards compatibility
      expires_at,
      expiresAt, // backwards compatibility
      stripe_coupon_id,
      stripeCouponId, // backwards compatibility
      stripe_promotion_code_id,
      stripePromotionCodeId, // backwards compatibility
      discount_percent,
      discountPercent, // backwards compatibility
      discount_amount,
      discountAmount, // backwards compatibility
      discount_duration,
      discountDuration, // backwards compatibility
      discount_duration_months,
      discountDurationMonths, // backwards compatibility
    } = await request.json();
    
    // Use snake_case values if provided, otherwise fall back to camelCase for backwards compatibility
    const finalCodeType = code_type || codeType || "trial";
    const finalTrialDays = trial_days ?? trialDays ?? 90;
    const finalPlanName = plan_name || planName || "AI Coach";
    const finalApplicablePlans = applicable_plans || applicablePlans || [finalPlanName];
    const finalMaxUses = max_uses ?? maxUses;
    const finalExpiresAt = expires_at || expiresAt;
    const finalStripeCouponId = stripe_coupon_id || stripeCouponId;
    const finalStripePromotionCodeId = stripe_promotion_code_id || stripePromotionCodeId;
    const finalDiscountPercent = discount_percent ?? discountPercent;
    const finalDiscountAmount = discount_amount ?? discountAmount;
    const finalDiscountDuration = discount_duration || discountDuration;
    const finalDiscountDurationMonths = discount_duration_months ?? discountDurationMonths;

    if (!code?.trim()) {
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    // Use admin client for admin operations
    // Admin endpoints need full access to create/update/delete promo codes
    const supabase = createAdminClient();

    // Check if code already exists
    const { data: existing } = await supabase
      .from("promo_codes")
      .select("id")
      .eq("code", code.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Promo code already exists" },
        { status: 400 }
      );
    }

    // Create new promo code
    const { data: promoCode, error } = await supabase
      .from("promo_codes")
      .insert({
        code: code.toUpperCase(),
        description,
        code_type: finalCodeType,
        trial_days: finalCodeType === "free_forever" ? 36500 : finalTrialDays, // 100 years for free_forever
        plan_name: finalPlanName,
        applicable_plans: finalApplicablePlans,
        max_uses: finalMaxUses || null,
        expires_at: finalExpiresAt || null,
        stripe_coupon_id: finalStripeCouponId || null,
        stripe_promotion_code_id: finalStripePromotionCodeId || null,
        discount_percent: finalDiscountPercent || null,
        discount_amount: finalDiscountAmount || null,
        discount_duration: finalDiscountDuration || null,
        discount_duration_months: finalDiscountDurationMonths || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the action with request for IP capture
    await AuditService.logPromoCodeCreated(user.id, promoCode, request);

    return NextResponse.json({ 
      success: true, 
      promoCode,
      message: `Promo code '${code}' created successfully` 
    });
  } catch (error) {
    console.error("Error creating promo code:", error);
    return NextResponse.json(
      { error: "Failed to create promo code" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/promo-codes - Update promo code
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const {
      id,
      code,
      description,
      code_type,
      codeType,
      trial_days,
      trialDays,
      applicable_plans,
      applicablePlans,
      max_uses,
      maxUses,
      expires_at,
      expiresAt,
      stripe_coupon_id,
      stripeCouponId,
      stripe_promotion_code_id,
      stripePromotionCodeId,
      discount_percent,
      discountPercent,
      discount_amount,
      discountAmount,
      discount_duration,
      discountDuration,
      discount_duration_months,
      discountDurationMonths,
      active,
      is_welcome_offer
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Promo code ID is required" },
        { status: 400 }
      );
    }

    // Use admin client for admin operations
    // Admin endpoints need full access to create/update/delete promo codes
    const supabase = createAdminClient();
    
    // Get current promo code for audit log
    const { data: oldPromoCode } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("id", id)
      .single();
    
    const updateData: any = {};
    
    // Handle both snake_case and camelCase for backwards compatibility
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (description !== undefined) updateData.description = description;
    if ((code_type || codeType) !== undefined) updateData.code_type = code_type || codeType;
    if ((trial_days ?? trialDays) !== undefined) updateData.trial_days = trial_days ?? trialDays;
    if ((applicable_plans || applicablePlans) !== undefined) updateData.applicable_plans = applicable_plans || applicablePlans;
    if ((max_uses ?? maxUses) !== undefined) updateData.max_uses = (max_uses ?? maxUses) || null;
    if ((expires_at || expiresAt) !== undefined) updateData.expires_at = (expires_at || expiresAt) || null;
    if ((stripe_coupon_id || stripeCouponId) !== undefined) updateData.stripe_coupon_id = (stripe_coupon_id || stripeCouponId) || null;
    if ((stripe_promotion_code_id || stripePromotionCodeId) !== undefined) updateData.stripe_promotion_code_id = (stripe_promotion_code_id || stripePromotionCodeId) || null;
    if ((discount_percent ?? discountPercent) !== undefined) updateData.discount_percent = (discount_percent ?? discountPercent) || null;
    if ((discount_amount ?? discountAmount) !== undefined) updateData.discount_amount = (discount_amount ?? discountAmount) || null;
    if ((discount_duration || discountDuration) !== undefined) updateData.discount_duration = (discount_duration || discountDuration) || null;
    if ((discount_duration_months ?? discountDurationMonths) !== undefined) updateData.discount_duration_months = (discount_duration_months ?? discountDurationMonths) || null;
    if (typeof active === "boolean") updateData.active = active;
    if (typeof is_welcome_offer === "boolean") updateData.is_welcome_offer = is_welcome_offer;

    const { data: promoCode, error } = await supabase
      .from("promo_codes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the action
    if (typeof active === "boolean" && oldPromoCode) {
      await AuditService.logPromoCodeToggled(
        user.id, 
        id, 
        promoCode.code,
        oldPromoCode.active,
        active,
        request
      );
    } else if (oldPromoCode) {
      await AuditService.logPromoCodeUpdated(user.id, id, oldPromoCode, promoCode, request);
    }

    return NextResponse.json({ 
      success: true, 
      promoCode,
      message: "Promo code updated successfully" 
    });
  } catch (error) {
    console.error("Error updating promo code:", error);
    return NextResponse.json(
      { error: "Failed to update promo code" },
      { status: 500 }
    );
  }
}