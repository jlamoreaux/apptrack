"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_NAMES, BILLING_CYCLES } from "@/lib/constants/plans";
import {
  getPlanFeatures,
  getPlanPrice,
  getYearlySavings,
  getPlanDisplayLimit,
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
    router.push(
      `/dashboard/upgrade/checkout?planId=${planId}&billingCycle=${billingCycle}`
    );
  };

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto py-8">
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
  const currentPlan = subscription?.subscription_plans;

  const renderFeatureIcon = (iconName: string, className = "h-4 w-4") => {
    const IconComponent = ICON_MAP[iconName as keyof typeof ICON_MAP] || Check;
    return <IconComponent className={className} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      <div className="container mx-auto py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
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

          {/* Billing Toggle */}
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
                  Save 20%
                </Badge>
              </Button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[freePlan, proPlan, aiCoachPlan].map((plan) => {
              if (!plan) return null;

              const price = getPlanPrice(plan, selectedBilling);
              const yearlySavings = getYearlySavings(plan.name);
              const features = getPlanFeatures(plan);

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
                    text:
                      currentPlan?.name === plan.name
                        ? "Current Plan"
                        : plan.name === PLAN_NAMES.FREE
                        ? "Downgrade"
                        : `Upgrade to ${plan.name}`,
                    href:
                      plan.name === PLAN_NAMES.FREE
                        ? "#"
                        : `/dashboard/upgrade/checkout?planId=${plan.id}&billingCycle=${selectedBilling}`,
                  }}
                  isCurrentPlan={currentPlan?.name === plan.name}
                  variant="upgrade"
                />
              );
            })}
          </div>

          {/* Add yearly savings info */}
          {selectedBilling === BILLING_CYCLES.YEARLY && (
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">
                💰 Save with yearly billing: Pro saves $4/year, AI Coach saves
                $18/year
              </p>
            </div>
          )}

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
