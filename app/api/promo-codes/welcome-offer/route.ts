import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    // Get the current welcome offer (if any)
    const { data: welcomeOffer, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("is_welcome_offer", true)
      .eq("active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found, which is okay
      loggerService.error('Error fetching welcome offer', error, {
        category: LogCategory.DATABASE,
        action: 'welcome_offer_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Failed to fetch welcome offer" },
        { status: 500 }
      );
    }

    // Format the offer message
    let offerMessage = "";
    if (welcomeOffer) {
      if (welcomeOffer.discount_percent) {
        offerMessage = `Welcome Bonus: Get ${welcomeOffer.discount_percent}% off`;
        
        if (welcomeOffer.discount_duration === "repeating" && welcomeOffer.discount_duration_months) {
          offerMessage += ` any paid plan for your first ${welcomeOffer.discount_duration_months} months!`;
        } else if (welcomeOffer.discount_duration === "once") {
          offerMessage += ` your first month!`;
        } else {
          offerMessage += ` any paid plan!`;
        }
      } else if (welcomeOffer.code_type === "trial") {
        const days = welcomeOffer.trial_days;
        const months = Math.round(days / 30);
        offerMessage = `Welcome Bonus: Get ${months} month${months > 1 ? 's' : ''} free trial of ${welcomeOffer.plan_names?.[0] || 'our premium plan'}!`;
      }
    }

    loggerService.info('Welcome offer retrieved', {
      category: LogCategory.BUSINESS,
      action: 'welcome_offer_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        hasWelcomeOffer: !!welcomeOffer,
        offerType: welcomeOffer?.code_type,
        discountPercent: welcomeOffer?.discount_percent,
        trialDays: welcomeOffer?.trial_days
      }
    });
    
    return NextResponse.json({
      welcomeOffer: welcomeOffer ? {
        ...welcomeOffer,
        offerMessage
      } : null,
    });
  } catch (error) {
    loggerService.error('Error in welcome offer route', error, {
      category: LogCategory.API,
      action: 'welcome_offer_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch welcome offer" },
      { status: 500 }
    );
  }
}