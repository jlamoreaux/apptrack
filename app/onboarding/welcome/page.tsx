"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { PLAN_NAMES } from "@/lib/constants/plans";

export default function OnboardingWelcomePage() {
  const { user, loading } = useSupabaseAuth();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const plans = [
    {
      name: PLAN_NAMES.FREE,
      title: "Free",
      price: "$0",
      period: "forever",
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
      price: "$2",
      period: "per month",
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
      price: "$9",
      period: "per month",
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

  const handlePlanSelection = async (planName: string) => {
    setSelectedPlan(planName);

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
      // Go to upgrade page with selected plan
      const plan = plans.find((p) => p.name === planName);
      if (plan) {
        router.push(
          `/dashboard/upgrade/checkout?planId=${planName
            .toLowerCase()
            .replace(" ", "-")}&billingCycle=monthly`
        );
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

        {/* Special Offer Banner */}
        <div className="max-w-4xl mx-auto mb-8">
          <Card className="border-2 border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-yellow-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gift className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="font-semibold text-foreground">
                      🎊 Welcome Bonus: Get 20% off any paid plan for your first
                      3 months!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Discount automatically applied at checkout • No code
                      needed
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <span className="text-3xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    /{plan.period}
                  </span>
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
                >
                  {plan.buttonText}
                  <ArrowRight className="ml-2 h-4 w-4" />
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
