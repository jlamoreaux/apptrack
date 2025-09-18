"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PromoTrialBanner } from "@/components/promo-trial-banner";
import Link from "next/link";
import { NavigationClient } from "@/components/navigation-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft,
  Check,
  Crown,
  Infinity,
  Heart,
  Bot,
  Sparkles,
  Brain,
  FileText,
  MessageSquare,
  Target,
  Tag,
  X,
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_NAMES, BILLING_CYCLES } from "@/lib/constants/plans";
import {
  getPlanFeatures,
  getPlanPrice,
  getYearlySavings,
  getPlanDisplayLimit,
  getPlanButtonText,
  isPlanDowngrade,
} from "@/lib/utils/plan-helpers";
import { PlanCard } from "@/components/shared/plan-card";

const ICON_MAP = {
  check: Check,
  infinity: Infinity,
  heart: Heart,
  brain: Brain,
  "file-text": FileText,
  "message-square": MessageSquare,
  target: Target,
  crown: Crown,
  bot: Bot,
  sparkles: Sparkles,
};

export default function UpgradePage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const {
    subscription,
    usage,
    plans,
    loading: subLoading,
  } = useSubscription(user?.id || null);
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">(
    BILLING_CYCLES.YEARLY
  );
  const [loading, setLoading] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handlePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError("Please enter a promo code");
      return;
    }

    setPromoError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/promo-codes/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: promoCode.toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPromoError(data.error || "Invalid promo code");
        setPromoSuccess(false);
        setAppliedPromo(null);
        return;
      }

      setPromoSuccess(true);
      setAppliedPromo(data);
      setShowPromoDialog(false);
      
      // Clear any previous error
      setPromoError(null);
    } catch (error) {
      setPromoError("Failed to apply promo code");
      setPromoSuccess(false);
      setAppliedPromo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (
    planId: string,
    billingCycle: "monthly" | "yearly",
    isDowngrade: boolean = false
  ) => {
    if (!user) return;
    
    // Check if we have a premium_free code
    const activeCode = appliedPromo;
    const isPremiumFree = activeCode?.code_type === "premium_free";
    
    // If it's a premium free code, apply it directly without Stripe checkout
    if (isPremiumFree && activeCode?.code) {
      setLoading(true);
      try {
        const response = await fetch("/api/promo/activate-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promoCode: activeCode.code }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to activate premium free code");
        }
        
        // Success! Redirect to dashboard
        router.push("/dashboard?premium_activated=true");
        return;
      } catch (error) {
        setPromoError(error instanceof Error ? error.message : "Failed to activate premium free code");
        setLoading(false);
        return;
      }
    }
    
    // Handle downgrades differently
    if (isDowngrade) {
      setLoading(true);
      try {
        const response = await fetch("/api/stripe/downgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, billingCycle }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to process downgrade");
        }
        
        // Show success message and redirect
        alert(data.message || "Your plan change has been scheduled.");
        router.push("/dashboard");
        return;
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to process downgrade");
        setLoading(false);
        return;
      }
    }
    
    // Regular checkout flow for upgrades with optional promo code
    let checkoutUrl = `/dashboard/upgrade/checkout?planId=${planId}&billingCycle=${billingCycle}`;
    if (appliedPromo) {
      if (appliedPromo.stripe_promotion_code_id) {
        checkoutUrl += `&promoCode=${appliedPromo.stripe_promotion_code_id}`;
      } else if (appliedPromo.stripe_coupon_id) {
        checkoutUrl += `&couponId=${appliedPromo.stripe_coupon_id}`;
      }
    }
    router.push(checkoutUrl);
  };


  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const freePlan = plans.find((plan) => plan.name === PLAN_NAMES.FREE);
  const proPlan = plans.find((plan) => plan.name === PLAN_NAMES.PRO);
  const aiCoachPlan = plans.find((plan) => plan.name === PLAN_NAMES.AI_COACH);
  
  // Handle both possible subscription structures
  const currentPlanName = subscription?.subscription_plans?.name || subscription?.plan;
  const currentPlan = currentPlanName ? { name: currentPlanName } : undefined;
  

  const renderFeatureIcon = (iconName: string, className = "h-4 w-4") => {
    const IconComponent = ICON_MAP[iconName as keyof typeof ICON_MAP] || Check;
    return <IconComponent className={className} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-primary">
              Choose Your Plan
            </h1>
            <p className="text-muted-foreground">
              {"You're currently using "}
              <span className="font-semibold">
                {usage?.applications_count || 0}
              </span>
              {" out of "}
              <span className="font-semibold">
                {currentPlanName === PLAN_NAMES.PRO ? "Unlimited" : 
                 currentPlanName === PLAN_NAMES.AI_COACH ? "Unlimited" : "5"}
              </span>
              {" applications on the "}
              <span className="font-semibold">
                {currentPlanName || PLAN_NAMES.FREE}
              </span>{" "}
              plan.
            </p>
          </div>

          {/* Show promo banner after title if user is on free tier */}
          {(!currentPlanName || currentPlanName === PLAN_NAMES.FREE) && (
            <PromoTrialBanner onActivate={() => window.location.reload()} />
          )}

          {/* Billing Toggle and Promo Code */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-1 rounded-lg">
                <Button
                  variant={
                    selectedBilling === BILLING_CYCLES.MONTHLY
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() => setSelectedBilling(BILLING_CYCLES.MONTHLY)}
                >
                  Monthly
                </Button>
                <Button
                  variant={
                    selectedBilling === BILLING_CYCLES.YEARLY
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() => setSelectedBilling(BILLING_CYCLES.YEARLY)}
                >
                  Yearly
                  <Badge variant="secondary" className="ml-2">
                    Save up to 33%
                  </Badge>
                </Button>
              </div>
              
              {/* Promo Code Button */}
              <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tag className="h-4 w-4 mr-2" />
                    {promoSuccess ? "Change Code" : "Have a promo code?"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Enter Promo Code</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handlePromoCode();
                        }
                      }}
                    />
                    {promoError && (
                      <Alert variant="destructive">
                        <AlertDescription>{promoError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPromoDialog(false);
                          setPromoCode("");
                          setPromoError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handlePromoCode} disabled={loading}>
                        {loading ? "Checking..." : "Apply"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Show applied promo */}
            {promoSuccess && appliedPromo && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  {appliedPromo.code} applied
                  {appliedPromo.discount_percent && ` - ${appliedPromo.discount_percent}% off`}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoSuccess(false);
                    setPromoCode("");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              💰 Save with yearly billing: Pro saves $8/year, AI Coach saves
              $28/year
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[freePlan, proPlan, aiCoachPlan].map((plan) => {
              if (!plan) return null;

              const originalPrice = getPlanPrice(plan, selectedBilling);
              
              // Calculate discounted price if promo is applied
              let discountedPrice = originalPrice;
              let showDiscount = false;
              
              if (appliedPromo && appliedPromo.discount_percent && plan.name !== PLAN_NAMES.FREE) {
                discountedPrice = Math.round(originalPrice * (1 - appliedPromo.discount_percent / 100));
                showDiscount = true;
              }
              
              const yearlySavings = getYearlySavings(plan.name);
              const features = getPlanFeatures(plan);
              const isCurrentPlan = currentPlanName === plan.name;
              const isDowngrade =
                currentPlanName &&
                isPlanDowngrade(currentPlanName, plan.name);
              const buttonText = getPlanButtonText(
                currentPlanName || PLAN_NAMES.FREE,
                plan.name,
                isCurrentPlan
              );
              

              return (
                <div 
                  key={plan.id} 
                  onClick={(e) => {
                    // Intercept clicks on downgrade buttons
                    if (isDowngrade && !isCurrentPlan) {
                      e.preventDefault();
                      e.stopPropagation();
                      const target = e.target as HTMLElement;
                      // Check if click was on the button or its parent link
                      if (target.closest('a') || target.closest('button')) {
                        handleUpgrade(plan.id, selectedBilling, true);
                      }
                    }
                  }}
                >
                  <PlanCard
                    planName={plan.name}
                    title={plan.name}
                    subtitle={
                      plan.name === PLAN_NAMES.FREE
                        ? "Perfect for getting started"
                        : plan.name === PLAN_NAMES.PRO
                        ? "For serious job seekers"
                        : "AI-powered career coaching"
                    }
                    price={
                      plan.name === PLAN_NAMES.FREE
                        ? null
                        : {
                            amount: showDiscount ? discountedPrice : originalPrice,
                            originalAmount: showDiscount ? originalPrice : undefined,
                            period:
                              selectedBilling === BILLING_CYCLES.MONTHLY
                                ? "month"
                                : "year",
                          }
                    }
                    features={features}
                    cta={{
                      text: buttonText,
                      href:
                        isCurrentPlan || isDowngrade
                          ? "#"
                          : `/dashboard/upgrade/checkout?planId=${plan.id}&billingCycle=${selectedBilling}`,
                    }}
                    isCurrentPlan={isCurrentPlan}
                    variant="upgrade"
                  />
                </div>
              );
            })}
          </div>

          {/* FAQ Section */}
          <div className="mt-16 space-y-8">
            <h2 className="text-2xl font-bold text-center text-primary">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Can I cancel anytime?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Yes! You can cancel your subscription at any time. {"We'll"}{" "}
                    even remind you to cancel when you mark a job as {"'Offer'"}{" "}
                    to help you save money.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    What happens to my data?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your data is always yours. Even if you downgrade to the free
                    plan, {"you'll"} keep access to your first 5 applications
                    and all your notes.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    How does AI coaching work?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Our AI coach uses advanced language models to analyze your
                    resume, prepare you for interviews, and provide personalized
                    career advice based on your goals and experience.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
