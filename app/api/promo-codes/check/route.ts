import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS on promo_codes table
    const supabase = createAdminClient();

    // Check if the promo code exists and is valid
    const { data: promoCode, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("active", true)
      .single();

    if (promoError || !promoCode) {
      return NextResponse.json(
        { error: "Invalid or expired promo code" },
        { status: 404 }
      );
    }

    // Check if code has expired
    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This promo code has expired" },
        { status: 400 }
      );
    }

    // Check usage limits
    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
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
  } catch (error) {
    console.error("Error checking promo code:", error);
    return NextResponse.json(
      { error: "Failed to check promo code" },
      { status: 500 }
    );
  }
}