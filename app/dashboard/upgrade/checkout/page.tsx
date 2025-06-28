"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NavigationClient } from "@/components/navigation-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSubscription } from "@/hooks/use-subscription";

function CheckoutContent() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const { plans, loading: subLoading } = useSubscription(user?.id || null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planId = searchParams.get("planId");
  const billingCycle = searchParams.get("billingCycle") as "monthly" | "yearly";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!planId || !billingCycle) {
      router.push("/dashboard/upgrade");
    }
  }, [planId, billingCycle, router]);

  const handleCheckout = async () => {
    if (!user || !planId || !billingCycle) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          billingCycle,
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout session");
      }
    } catch (err) {
      setError("Failed to create checkout session");
    } finally {
      setLoading(false);
    }
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

  if (!user || !planId || !billingCycle) return null;

  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    router.push("/dashboard/upgrade");
    return null;
  }

  const planPrice =
    billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/upgrade">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Plans
              </Button>
            </Link>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-primary">
              Complete Your Subscription
            </h1>
            <p className="text-muted-foreground">
              {"You're"} upgrading to the{" "}
              <span className="font-semibold">{plan.name}</span> plan
            </p>
          </div>

          {/* Plan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{plan.name} Plan</span>
                <Badge className="bg-secondary text-secondary-foreground">
                  ${planPrice}/{billingCycle === "monthly" ? "month" : "year"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features?.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-secondary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Checkout Button */}
          <Card>
            <CardContent className="pt-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md mb-4">
                  {error}
                </div>
              )}

              <Button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-secondary hover:bg-secondary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Checkout Session...
                  </>
                ) : (
                  <>
                    Continue to Secure Checkout - ${planPrice}/
                    {billingCycle === "monthly" ? "mo" : "yr"}
                  </>
                )}
              </Button>

              <div className="text-xs text-muted-foreground text-center space-y-1 mt-4">
                <p>🔒 You'll be redirected to Stripe's secure checkout</p>
                <p>You can cancel your subscription at any time</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
