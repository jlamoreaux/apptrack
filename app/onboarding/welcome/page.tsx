"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Check,
  Sparkles,
  Zap,
  Trophy,
  ArrowRight,
  Gift,
  Star,
  Crown,
  Brain,
  Tag,
  X,
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_NAMES } from "@/lib/constants/plans";

export default function OnboardingWelcomePage() {
  const { user, loading } = useSupabaseAuth();
  const { plans: dbPlans, loading: plansLoading, subscription } = useSubscription(user?.id || null);
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [welcomeOffer, setWelcomeOffer] = useState<any>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [showPromoDialog, setShowPromoDialog] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    // If user already has a paid subscription, redirect to dashboard
    if (!loading && !plansLoading && subscription?.subscription_plans?.name !== PLAN_NAMES.FREE) {
      console.log("User already has subscription, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [user, loading, plansLoading, subscription, router]);

  useEffect(() => {
    // Fetch the welcome offer when component mounts
    const fetchWelcomeOffer = async () => {
      try {
        const response = await fetch("/api/promo-codes/welcome-offer");
        const data = await response.json();
        console.log("Welcome offer fetched:", data.welcomeOffer);
        setWelcomeOffer(data.welcomeOffer);
      } catch (error) {
        console.error("Failed to fetch welcome offer:", error);
      }
    };

    fetchWelcomeOffer();
  }, []);

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
  const calculateDiscountedPrice = (originalPrice: number, discount: any) => {
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
        "Track up to 5 applications",
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
  
  console.log("dbPlans:", dbPlans);
  console.log("plans:", plans);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError("Please enter a promo code");
      return;
    }

    setPromoLoading(true);
    setPromoError(null);

    try {
      // Check if it's a free trial code
      const checkResponse = await fetch("/api/promo-codes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });

      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        setPromoError(checkData.error || "Invalid promo code");
        return;
      }

      // Store the applied promo for later use
      console.log("Promo code validated:", checkData.promoCode);
      setAppliedPromo(checkData.promoCode);
      setPromoSuccess(true);
      setShowPromoDialog(false);

      // If it's a premium free code, apply it immediately without payment
      if (checkData.promoCode.code_type === "premium_free") {
        const response = await fetch("/api/promo/activate-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promoCode: promoCode }),
        });

        const data = await response.json();

        if (!response.ok) {
          setPromoError(data.error || "Failed to apply promo code");
          setPromoSuccess(false);
        } else {
          // Mark onboarding complete and redirect to dashboard
          await fetch("/api/auth/complete-onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          router.push("/dashboard?promo=success");
        }
      }
    } catch (err) {
      setPromoError("An error occurred. Please try again.");
      setPromoSuccess(false);
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePlanSelection = async (planName: string) => {
    setSelectedPlan(planName);
    setIsCreatingCheckout(true);

    // Mark onboarding as complete via API
    try {
      await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to mark onboarding complete:", error);
    }

    if (planName === PLAN_NAMES.FREE) {
      // Go to dashboard for free users
      router.push("/dashboard");
    } else {
      try {
        // Find the actual plan ID from the database if available
        const dbPlan = dbPlans?.find(p => p.name === planName);
        const planId = dbPlan?.id || planName.toLowerCase().replace(" ", "-");
        
        // Check if we have a premium free code (no payment required - friends & family)
        const activeCode = appliedPromo || welcomeOffer;
        console.log("Active code details:", {
          code: activeCode?.code,
          code_type: activeCode?.code_type,
          appliedPromo,
          welcomeOffer
        });
        const isPremiumFree = activeCode?.code_type === "premium_free";
        
        // If it's a premium free code, apply it directly without Stripe checkout
        if (isPremiumFree && activeCode?.code) {
          console.log("Applying premium free code (no payment required):", activeCode.code);
          
          const response = await fetch("/api/promo/activate-trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              promoCode: activeCode.code
            }),
          });

          const data = await response.json();
          console.log("Trial activation response:", response.status, data);

          if (!response.ok) {
            console.error("Failed to apply free trial:", data.error);
            setIsCreatingCheckout(false);
            // Fall through to regular checkout
          } else {
            // Successfully applied free trial, go to dashboard
            console.log("Trial applied successfully, redirecting to dashboard");
            router.push("/dashboard?welcome=success");
            return;
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

        console.log("Using discount:", { promoCode, couponId });

        // Create Stripe checkout session directly
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
          }),
        });

        const data = await response.json();

        if (data.url) {
          // Redirect directly to Stripe checkout
          window.location.href = data.url;
        } else {
          console.error("Failed to create checkout session:", data.error);
          setIsCreatingCheckout(false);
          // Fallback to checkout page with discount info
          let fallbackUrl = `/dashboard/upgrade/checkout?planId=${planId}&billingCycle=${selectedBilling}`;
          if (promoCode) {
            fallbackUrl += `&promoCode=${promoCode}`;
          }
          if (couponId) {
            fallbackUrl += `&couponId=${couponId}`;
          }
          // Pass discount percentage for display
          const discount = welcomeOffer?.discount_percent || appliedPromo?.discount_percent;
          if (discount) {
            fallbackUrl += `&discount=${discount}`;
          }
          router.push(fallbackUrl);
        }
      } catch (error) {
        console.error("Error creating checkout:", error);
        setIsCreatingCheckout(false);
      }
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
        <div className="max-w-4xl mx-auto mb-8">
          <Card className="border-2 border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-yellow-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Gift className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {promoSuccess && appliedPromo ? (
                        <>
                          ✅ Promo Code Applied: {appliedPromo.code}
                        </>
                      ) : welcomeOffer ? (
                        <>
                          🎊 {welcomeOffer.offerMessage || "Welcome Bonus Active!"}
                        </>
                      ) : (
                        "Special offers available!"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {promoSuccess ? (
                        "Your discount will be applied at checkout"
                      ) : welcomeOffer ? (
                        "Discount automatically applied • No code needed"
                      ) : (
                        "Check for available promo codes"
                      )}
                    </p>
                  </div>
                </div>
                <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Tag className="h-4 w-4 mr-2" />
                      {promoSuccess ? "Change Code" : "Have a promo code?"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Enter Promo Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter your promo code"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                          disabled={promoLoading}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoCode.trim()}
                        >
                          {promoLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Applying...
                            </>
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      </div>
                      {promoError && (
                        <Alert className="border-destructive/50 bg-destructive/10">
                          <AlertDescription className="text-destructive text-sm">
                            {promoError}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-muted p-1 rounded-lg">
            <Button
              variant={selectedBilling === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedBilling("monthly")}
            >
              Monthly
            </Button>
            <Button
              variant={selectedBilling === "yearly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedBilling("yearly")}
            >
              Yearly
              <Badge variant="secondary" className="ml-2">
                Save up to 33%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12 px-4 md:px-0">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative transition-all duration-200 hover:shadow-xl ${
                plan.popular
                  ? "border-2 border-primary shadow-lg md:scale-105 lg:scale-110"
                  : "border-border"
              } ${selectedPlan === plan.name ? "ring-2 ring-primary" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    MOST POPULAR
                  </Badge>
                </div>
              )}

              <CardHeader className="space-y-2 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-foreground">
                    {plan.title}
                  </h3>
                  {plan.name === PLAN_NAMES.PRO && (
                    <Crown className="h-5 w-5 text-yellow-500" />
                  )}
                  {plan.name === PLAN_NAMES.AI_COACH && (
                    <Brain className="h-5 w-5 text-purple-500" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <div className="pt-3">
                  {(() => {
                    const originalPrice =
                      selectedBilling === "monthly"
                        ? plan.monthlyPrice
                        : plan.yearlyPrice;
                    const isEligible =
                      plan.name !== PLAN_NAMES.FREE &&
                      (!activeDiscount?.applicable_plans ||
                        activeDiscount.applicable_plans.includes(plan.name));
                    const discountedPrice = isEligible
                      ? calculateDiscountedPrice(originalPrice, activeDiscount)
                      : originalPrice;
                    const hasDiscount =
                      isEligible &&
                      activeDiscount &&
                      discountedPrice < originalPrice;

                    return (
                      <>
                        {hasDiscount && (
                          <span className="text-xl text-muted-foreground line-through mr-2">
                            ${originalPrice}
                          </span>
                        )}
                        <span className="text-3xl font-bold text-foreground">
                          $
                          {plan.name === PLAN_NAMES.FREE
                            ? "0"
                            : discountedPrice.toFixed(
                                discountedPrice % 1 === 0 ? 0 : 2
                              )}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {plan.name === PLAN_NAMES.FREE
                            ? "/forever"
                            : selectedBilling === "monthly"
                            ? "/month"
                            : "/year"}
                        </span>
                        {hasDiscount &&
                          activeDiscount?.discount_duration === "repeating" &&
                          activeDiscount?.discount_duration_months && (
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              Discounted for{" "}
                              {activeDiscount.discount_duration_months} months
                            </div>
                          )}
                      </>
                    );
                  })()}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePlanSelection(plan.name)}
                  variant={plan.buttonVariant}
                  className={`w-full font-semibold ${
                    plan.gradient
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                      : ""
                  }`}
                  size="lg"
                  disabled={isCreatingCheckout}
                >
                  {isCreatingCheckout && selectedPlan === plan.name ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating checkout...
                    </>
                  ) : (
                    <>
                      {plan.buttonText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            Why Choose a Paid Plan?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card border border-border">
              <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <h3 className="font-semibold text-foreground mb-1">
                Land Jobs Faster
              </h3>
              <p className="text-sm text-muted-foreground">
                Track unlimited applications and stay organized throughout your
                search
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
              <Trophy className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-semibold text-foreground mb-1">Stand Out</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered tools help you craft winning resumes and ace
                interviews
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
              <Star className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-semibold text-foreground mb-1">Save Time</h3>
              <p className="text-sm text-muted-foreground">
                Automated tracking and AI assistance means less busywork, more
                results
              </p>
            </div>
          </div>

          <div className="pt-6">
            <p className="text-muted-foreground">
              Not ready to commit?
              <Link
                href="/dashboard"
                className="text-primary hover:underline ml-1"
              >
                Continue with Free plan
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
