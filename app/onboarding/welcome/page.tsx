"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_NAMES, PLAN_LIMITS } from "@/lib/constants/plans";
import { clientLogger } from "@/lib/utils/client-logger";
import { LogCategory } from "@/lib/services/logger.types";
import type { PromoCode, WelcomeOffer, TrafficSourceTrial } from "@/types/promo-codes";
import { toast } from "@/hooks/use-toast";
import { OfferBanner } from "@/components/onboarding/offer-banner";
import { PlanCard } from "@/components/onboarding/plan-card";
import { BenefitsSection } from "@/components/onboarding/benefits-section";
import { BillingToggle } from "@/components/onboarding/billing-toggle";
import { useTrialManagement } from "@/hooks/use-trial-management";
import { usePromoCodes } from "@/hooks/use-promo-codes";
import { createCheckoutSession, buildCheckoutFallbackUrl } from "@/lib/checkout/create-checkout";
import { UI_DELAYS } from "@/lib/constants/timeouts";

export default function OnboardingWelcomePage() {
  const { user, loading } = useSupabaseAuth();
  const { plans: dbPlans, loading: plansLoading, subscription } = useSubscription(user?.id || null);
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeOffer | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">("yearly");
  
  // Use the new hooks
  const { 
    trafficTrial, 
    shouldAutoSelectPlan, 
    getTrialDays 
  } = useTrialManagement({ user });
  
  const {
    promoCode,
    setPromoCode,
    promoLoading,
    promoError,
    promoSuccess,
    appliedPromo,
    showPromoDialog,
    setShowPromoDialog,
    handleApplyPromo,
  } = usePromoCodes();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    
    // Log the subscription state for debugging
    if (!loading && !plansLoading) {
      const currentPlanName = subscription?.subscription_plans?.name || subscription?.plan;
      
      clientLogger.debug("Onboarding page subscription check", {
        category: LogCategory.AUTH,
        action: 'onboarding_subscription_check',
        subscription,
        currentPlanName,
        hasPaidSubscription: currentPlanName && currentPlanName !== PLAN_NAMES.FREE
      });
    }
    
    // If user already has a paid subscription, redirect to dashboard
    // Handle both subscription structures (subscription.plan and subscription.subscription_plans.name)
    const currentPlanName = subscription?.subscription_plans?.name || subscription?.plan;
    
    if (!loading && !plansLoading && currentPlanName && currentPlanName !== PLAN_NAMES.FREE) {
      clientLogger.info("User has paid subscription, redirecting to dashboard", {
        category: LogCategory.AUTH,
        action: 'onboarding_redirect_paid_user',
        planName: currentPlanName
      });
      router.push("/dashboard");
    }
  }, [user, loading, plansLoading, subscription, router]);

  useEffect(() => {
    // Fetch the welcome offer when component mounts
    const fetchWelcomeOffer = async () => {
      try {
        const response = await fetch("/api/promo-codes/welcome-offer");
        if (response.ok) {
          const data = await response.json();
          setWelcomeOffer(data.welcomeOffer);
        } else {
          clientLogger.warn("Failed to fetch welcome offer", {
            category: LogCategory.BUSINESS,
            action: 'welcome_offer_fetch_failed',
            metadata: { status: response.status }
          });
        }
      } catch (error) {
        clientLogger.error("Error fetching welcome offer", {
          category: LogCategory.BUSINESS,
          action: 'welcome_offer_fetch_error',
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    };

    fetchWelcomeOffer();
    
    // Auto-select plan if needed (handled by useTrialManagement)
    if (shouldAutoSelectPlan && !selectedPlan) {
      setTimeout(() => {
        handlePlanSelection(PLAN_NAMES.AI_COACH);
      }, UI_DELAYS.AUTO_SELECT_PLAN);
    }
  }, [user, shouldAutoSelectPlan, selectedPlan]);

  if (loading || plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Calculate discounted prices
  const calculateDiscountedPrice = (originalPrice: number, discount: PromoCode | WelcomeOffer | null) => {
    if (!discount) return originalPrice;

    if (discount.discount_percent) {
      return originalPrice * (1 - discount.discount_percent / 100);
    }
    if (discount.discount_amount) {
      return Math.max(0, originalPrice - discount.discount_amount);
    }
    return originalPrice;
  };

  // Get the active discount (either applied promo or welcome offer)
  const activeDiscount = appliedPromo || welcomeOffer;

  // Map database plans to display format, or use fallback if not loaded
  const plans = dbPlans?.length ? dbPlans.map(plan => ({
    name: plan.name,
    title: plan.name,
    monthlyPrice: plan.price_monthly || 0,
    yearlyPrice: plan.price_yearly || 0,
    description: 
      plan.name === PLAN_NAMES.FREE ? "Perfect for trying out AppTrack" :
      plan.name === PLAN_NAMES.PRO ? "For serious job seekers" :
      "Your AI-powered career assistant",
    features: plan.features || [],
    buttonText: plan.name === PLAN_NAMES.FREE ? "Start Free" : `Start with ${plan.name}`,
    buttonVariant: plan.name === PLAN_NAMES.FREE ? "outline" as const : "default" as const,
    popular: plan.name === PLAN_NAMES.AI_COACH,
    gradient: plan.name === PLAN_NAMES.AI_COACH,
  })) : [
    // Fallback plans if database plans not loaded
    {
      name: PLAN_NAMES.FREE,
      title: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: "Perfect for trying out AppTrack",
      features: [
        `Track up to ${PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications`,
        "Basic interview notes",
        "Contact management",
      ],
      buttonText: "Start Free",
      buttonVariant: "outline" as const,
      popular: false,
    },
    {
      name: PLAN_NAMES.PRO,
      title: "Pro",
      monthlyPrice: 2,
      yearlyPrice: 16,
      description: "For serious job seekers",
      features: [
        "Unlimited applications",
        "All Free features",
        "Priority support",
      ],
      buttonText: "Start with Pro",
      buttonVariant: "default" as const,
      popular: false,
    },
    {
      name: PLAN_NAMES.AI_COACH,
      title: "AI Coach",
      monthlyPrice: 9,
      yearlyPrice: 80,
      description: "Your AI-powered career assistant",
      features: [
        "Everything in Pro",
        "AI Resume Analysis",
        "Interview Preparation",
        "Job Fit Analysis",
        "Cover Letter Generation",
        "Personalized Career Advice",
      ],
      buttonText: "Start with AI Coach",
      buttonVariant: "default" as const,
      popular: true,
      gradient: true,
    },
  ];
  

  // The handleApplyPromo function is now provided by usePromoCodes hook

  const handlePlanSelection = async (planName: string) => {
    setSelectedPlan(planName);
    setIsCreatingCheckout(true);

    try {
      // Find the actual plan ID from the database if available
      const dbPlan = dbPlans?.find(p => p.name === planName);
      const planId = dbPlan?.id || planName.toLowerCase().replace(" ", "-");
      
      // Get trial days for this plan
      const trialDays = getTrialDays(planName);
      
      // Create checkout session using the utility
      const checkoutUrl = await createCheckoutSession({
        planName,
        planId,
        selectedBilling,
        appliedPromo,
        welcomeOffer,
        trialDays,
        onSuccess: () => {
          setIsCreatingCheckout(false);
        },
        onError: (error) => {
          setIsCreatingCheckout(false);
        }
      });
      
      if (checkoutUrl) {
        if (checkoutUrl.startsWith("http")) {
          // External URL (Stripe checkout)
          window.location.href = checkoutUrl;
        } else {
          // Internal route
          router.push(checkoutUrl);
        }
      } else {
        // Fallback to upgrade page if something went wrong
        const fallbackUrl = buildCheckoutFallbackUrl(planId, selectedBilling, appliedPromo, welcomeOffer);
        router.push(fallbackUrl);
      }
    } catch (error) {
      setIsCreatingCheckout(false);
      console.error("Error in plan selection:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Welcome Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Welcome to AppTrack, {user?.user_metadata?.name || "there"}! 🎉
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
            You're one step away from supercharging your job search. Choose the
            plan that fits your needs.
          </p>
        </div>

        {/* Combined Offer Banner */}
        <OfferBanner
          trafficTrial={trafficTrial}
          promoSuccess={promoSuccess}
          appliedPromo={appliedPromo}
          welcomeOffer={welcomeOffer}
          showPromoDialog={showPromoDialog}
          setShowPromoDialog={setShowPromoDialog}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          promoLoading={promoLoading}
          promoError={promoError}
          handleApplyPromo={handleApplyPromo}
          trafficSource={user?.user_metadata?.traffic_source}
        />

        {/* Billing Toggle */}
        <BillingToggle 
          selectedBilling={selectedBilling}
          onToggle={setSelectedBilling}
        />

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12 px-4 md:px-0">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              selectedBilling={selectedBilling}
              activeDiscount={activeDiscount}
              calculateDiscountedPrice={calculateDiscountedPrice}
              onSelect={handlePlanSelection}
              isCreatingCheckout={isCreatingCheckout}
              selectedPlan={selectedPlan}
            />
          ))}
        </div>

        {/* Benefits Section */}
        <BenefitsSection />
      </div>
    </div>
  );
}
