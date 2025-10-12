import { PLAN_NAMES } from "@/lib/constants/plans";
import type { PromoCode, WelcomeOffer } from "@/types/promo-codes";
import { toast } from "@/hooks/use-toast";
import { clientLogger } from "@/lib/utils/client-logger";
import { LogCategory } from "@/lib/services/logger.types";

interface CreateCheckoutOptions {
  planName: string;
  planId: string;
  selectedBilling: "monthly" | "yearly";
  appliedPromo?: PromoCode | null;
  welcomeOffer?: WelcomeOffer | null;
  trialDays?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export async function createCheckoutSession(options: CreateCheckoutOptions): Promise<string | null> {
  const {
    planName,
    planId,
    selectedBilling,
    appliedPromo,
    welcomeOffer,
    trialDays = 0,
    onSuccess,
    onError,
  } = options;

  try {
    // First, mark onboarding as complete
    await fetch("/api/auth/complete-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    // Handle free plan
    if (planName === PLAN_NAMES.FREE) {
      if (onSuccess) onSuccess();
      return "/dashboard";
    }

    // Check if we have a premium free code (no payment required)
    const activeCode = appliedPromo || welcomeOffer;
    const isPremiumFree = activeCode?.code_type === "premium_free";
    
    // If it's a premium free code, apply it directly without Stripe checkout
    if (isPremiumFree && activeCode?.code) {
      const response = await fetch("/api/promo/activate-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          promoCode: activeCode.code
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error applying code",
          description: "There was an issue applying your promo code. Please try again.",
          variant: "destructive",
        });
        throw new Error(data.error || "Failed to apply promo code");
      } else {
        toast({
          title: "Welcome to AppTrack Premium!",
          description: "Your premium access has been activated.",
        });
        if (onSuccess) onSuccess();
        return "/dashboard?welcome=success";
      }
    }
    
    // Determine which discount to use for Stripe checkout
    let promoCode = null;
    let couponId = null;
    
    if (appliedPromo) {
      if (appliedPromo.stripe_promotion_code_id || appliedPromo.stripe_promo_code_id) {
        promoCode = appliedPromo.stripe_promotion_code_id || appliedPromo.stripe_promo_code_id;
      } else if (appliedPromo.stripe_coupon_id) {
        couponId = appliedPromo.stripe_coupon_id;
      }
    } else if (welcomeOffer) {
      if (welcomeOffer.stripe_promotion_code_id || welcomeOffer.stripe_promo_code_id) {
        promoCode = welcomeOffer.stripe_promotion_code_id || welcomeOffer.stripe_promo_code_id;
      } else if (welcomeOffer.stripe_coupon_id) {
        couponId = welcomeOffer.stripe_coupon_id;
      }
    }

    // Show appropriate toast
    if (trialDays > 0) {
      toast({
        title: "Setting up your free trial",
        description: `You'll get ${trialDays} days free. Cancel anytime.`,
      });
    } else {
      toast({
        title: "Creating checkout session",
        description: "Redirecting to secure payment...",
      });
    }

    // Create Stripe checkout session
    const response = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId,
        billingCycle: selectedBilling,
        promoCode,
        couponId,
        trialDays,
      }),
    });

    const data = await response.json();

    if (data.url) {
      if (onSuccess) onSuccess();
      // Return URL to redirect to
      return data.url;
    } else {
      throw new Error("No checkout URL returned");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    toast({
      title: "Something went wrong",
      description: "There was an error creating your checkout session. Please try again.",
      variant: "destructive",
    });
    
    clientLogger.error("Failed to create checkout session", {
      category: LogCategory.PAYMENT,
      action: "checkout_creation_error",
      error: errorMessage,
      metadata: { planName, selectedBilling }
    });
    
    if (onError) {
      onError(error instanceof Error ? error : new Error(errorMessage));
    }
    
    return null;
  }
}

export function buildCheckoutFallbackUrl(
  planId: string,
  selectedBilling: "monthly" | "yearly",
  appliedPromo?: PromoCode | null,
  welcomeOffer?: WelcomeOffer | null
): string {
  let fallbackUrl = `/dashboard/upgrade/checkout?planId=${planId}&billingCycle=${selectedBilling}`;
  
  const activeDiscount = appliedPromo || welcomeOffer;
  
  if (activeDiscount?.stripe_promotion_code_id || activeDiscount?.stripe_promo_code_id) {
    const promoCode = activeDiscount.stripe_promotion_code_id || activeDiscount.stripe_promo_code_id;
    fallbackUrl += `&promoCode=${promoCode}`;
  }
  
  if (activeDiscount?.stripe_coupon_id) {
    fallbackUrl += `&couponId=${activeDiscount.stripe_coupon_id}`;
  }
  
  if (activeDiscount?.discount_percent) {
    fallbackUrl += `&discount=${activeDiscount.discount_percent}`;
  }
  
  return fallbackUrl;
}