"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PromoTrialBanner } from "@/components/promo-trial-banner";
import Link from "next/link";
import { NavigationClient } from "@/components/navigation-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { DiscountCodeModal } from "@/components/discount-code-modal";
import { PromoSuccessModal } from "@/components/promo-success-modal";
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
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [applyingFreeCode, setApplyingFreeCode] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleUpgrade = async (
    planId: string,
    billingCycle: "monthly" | "yearly"
  ) => {
    if (!user) return;
    let url = `/dashboard/upgrade/checkout?planId=${planId}&billingCycle=${billingCycle}`;
    if (discountCode) {
      url += `&discount=${encodeURIComponent(discountCode)}`;
    }
    router.push(url);
  };

  const handleDiscountApply = async (code: string, codeType?: string) => {
    // If it's a "free forever" code, apply it immediately without checkout
    if (codeType === "free_forever") {
      setApplyingFreeCode(true);
      try {
        const response = await fetch("/api/stripe/apply-free-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          setApplyingFreeCode(false);
          setSuccessMessage(data.message || "Your free forever access has been activated!");
          setShowSuccessModal(true);
          
          // Redirect to dashboard with success message
          setTimeout(() => {
            const successMessage = encodeURIComponent(data.message || "Successfully upgraded!");
            router.push(`/dashboard?upgrade_success=true&message=${successMessage}`);
          }, 2000);
        } else {
          setApplyingFreeCode(false);
          alert(data.error || "Failed to apply code");
        }
      } catch (error) {
        console.error("Error applying free code:", error);
        alert("Failed to apply code. Please try again.");
        setApplyingFreeCode(false);
      }
    } else {
      // For regular discount codes, save for checkout
      setDiscountCode(code);
    }
  };

  if (authLoading || subLoading || plans.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">Loading plans...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const freePlan = plans.find((plan) => plan.name === PLAN_NAMES.FREE);
  const proPlan = plans.find((plan) => plan.name === PLAN_NAMES.PRO);
  const aiCoachPlan = plans.find((plan) => plan.name === PLAN_NAMES.AI_COACH);
  const currentPlan = subscription?.subscription_plans;
  
  console.log("Upgrade page - all plans from DB:", plans);
  console.log("Upgrade page - plan names in DB:", plans.map(p => p.name));
  console.log("Upgrade page - looking for:", { 
    FREE: PLAN_NAMES.FREE, 
    PRO: PLAN_NAMES.PRO, 
    AI_COACH: PLAN_NAMES.AI_COACH 
  });
  console.log("Upgrade page - found plans:", {
    freePlan: freePlan?.name || "NOT FOUND",
    proPlan: proPlan?.name || "NOT FOUND", 
    aiCoachPlan: aiCoachPlan?.name || "NOT FOUND"
  });

  const renderFeatureIcon = (iconName: string, className = "h-4 w-4") => {
    const IconComponent = ICON_MAP[iconName as keyof typeof ICON_MAP] || Check;
    return <IconComponent className={className} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      
      {/* Loading overlay when applying free code */}
      {applyingFreeCode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="p-6 max-w-sm">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div>
                <p className="text-lg font-semibold">Applying Free Forever Code</p>
                <p className="text-sm text-muted-foreground">
                  Cancelling any active subscriptions and upgrading you to free forever...
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
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
                {currentPlan ? getPlanDisplayLimit(currentPlan) : "5"}
              </span>
              {" applications on the "}
              <span className="font-semibold">
                {currentPlan?.name || PLAN_NAMES.FREE}
              </span>{" "}
              plan.
            </p>
          </div>

          {/* Show promo banner after title if user is on free tier */}
          {subscription?.subscription_plans?.name === PLAN_NAMES.FREE && (
            <PromoTrialBanner onActivate={() => window.location.reload()} />
          )}

          {/* Billing Toggle and Discount Code */}
          <div className="space-y-4">
            <div className="flex justify-center">
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
            </div>
            
            {/* Discount Code Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiscountModal(true)}
                className="gap-2"
              >
                <Tag className="h-4 w-4" />
                {discountCode ? `Code: ${discountCode}` : "Have a discount code?"}
              </Button>
            </div>
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
              if (!plan || !plan.id) {
                console.warn("Plan missing or has no ID:", plan);
                return null;
              }

              const price = getPlanPrice(plan, selectedBilling);
              const yearlySavings = getYearlySavings(plan.name);
              const features = getPlanFeatures(plan);
              const isCurrentPlan = currentPlan?.name === plan.name;
              const isDowngrade =
                currentPlan?.name &&
                isPlanDowngrade(currentPlan.name, plan.name);
              const buttonText = getPlanButtonText(
                currentPlan?.name || PLAN_NAMES.FREE,
                plan.name,
                isCurrentPlan
              );
              
              let checkoutUrl = "#";
              if (!isCurrentPlan && !isDowngrade) {
                checkoutUrl = `/dashboard/upgrade/checkout?planId=${plan.id}&billingCycle=${selectedBilling}`;
                if (discountCode) {
                  checkoutUrl += `&discount=${encodeURIComponent(discountCode)}`;
                }
              }
              
              console.log(`Plan ${plan.name} - ID: ${plan.id}, URL: ${checkoutUrl}, Discount: ${discountCode || 'none'}`);

              return (
                <PlanCard
                  key={plan.id}
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
                          amount: price,
                          period:
                            selectedBilling === BILLING_CYCLES.MONTHLY
                              ? "month"
                              : "year",
                        }
                  }
                  features={features}
                  cta={{
                    text: buttonText,
                    href: checkoutUrl,
                  }}
                  isCurrentPlan={isCurrentPlan}
                  variant="upgrade"
                />
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
      
      {/* Discount Code Modal */}
      <DiscountCodeModal
        open={showDiscountModal}
        onOpenChange={setShowDiscountModal}
        onApply={handleDiscountApply}
      />
      
      {/* Success Modal for Free Forever Codes */}
      <PromoSuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        message={successMessage}
      />
    </div>
  );
}
