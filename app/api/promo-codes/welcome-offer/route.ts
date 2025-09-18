import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/promo-codes/welcome-offer - Get the current welcome offer
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the active welcome offer promo code
    const { data: welcomeOffer, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("is_welcome_offer", true)
      .eq("active", true)
      .eq("code_type", "discount")
      .single();

    if (error || !welcomeOffer) {
      // Return null if no welcome offer is set
      return NextResponse.json({ welcomeOffer: null });
    }

    // Format the offer message based on the discount type
    let offerMessage = "";
    let shortMessage = "";
    
    if (welcomeOffer.discount_percent) {
      shortMessage = `${welcomeOffer.discount_percent}% off`;
      offerMessage = `Get ${welcomeOffer.discount_percent}% off`;
      
      if (welcomeOffer.discount_duration === "repeating" && welcomeOffer.discount_duration_months) {
        offerMessage += ` for your first ${welcomeOffer.discount_duration_months} months`;
      } else if (welcomeOffer.discount_duration === "once") {
        offerMessage += ` your first payment`;
      } else if (welcomeOffer.discount_duration === "forever") {
        offerMessage += ` forever`;
      }
    } else if (welcomeOffer.discount_amount) {
      const dollars = (welcomeOffer.discount_amount / 100).toFixed(2);
      shortMessage = `$${dollars} off`;
      offerMessage = `Get $${dollars} off`;
      
      if (welcomeOffer.discount_duration === "repeating" && welcomeOffer.discount_duration_months) {
        offerMessage += ` per month for ${welcomeOffer.discount_duration_months} months`;
      } else if (welcomeOffer.discount_duration === "once") {
        offerMessage += ` your first payment`;
      } else if (welcomeOffer.discount_duration === "forever") {
        offerMessage += ` every payment`;
      }
    }
    
    // Add plan specification
    if (welcomeOffer.applicable_plans && Array.isArray(welcomeOffer.applicable_plans)) {
      if (welcomeOffer.applicable_plans.length === 1) {
        offerMessage += ` on ${welcomeOffer.applicable_plans[0]} plan`;
      } else if (welcomeOffer.applicable_plans.length === 2) {
        offerMessage += ` on any paid plan`;
      }
    }

    return NextResponse.json({
      welcomeOffer: {
        code: welcomeOffer.code,
        stripe_coupon_id: welcomeOffer.stripe_coupon_id,
        offerMessage: offerMessage || welcomeOffer.description,
        shortMessage: shortMessage,
        description: welcomeOffer.description,
        discount_percent: welcomeOffer.discount_percent,
        discount_amount: welcomeOffer.discount_amount,
        discount_duration: welcomeOffer.discount_duration,
        discount_duration_months: welcomeOffer.discount_duration_months,
        applicable_plans: welcomeOffer.applicable_plans,
      }
    });
  } catch (error) {
    console.error("Error fetching welcome offer:", error);
    return NextResponse.json({ welcomeOffer: null });
  }
}