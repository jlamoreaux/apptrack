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
  const promoCode = searchParams.get("promoCode");
  const couponId = searchParams.get("couponId");
  const discountCode = searchParams.get("discount");
  const discountPercent = searchParams.get("discountPercent");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    console.log("Checkout page - planId:", planId, "billingCycle:", billingCycle);
    console.log("Available plans:", plans);
  }, [planId, billingCycle, plans]);

  const handleCheckout = async () => {
    console.log("handleCheckout called with:", { user: user?.id, planId, billingCycle, discountCode });
    
    if (!user || !planId || !billingCycle) {
      console.error("Missing required data:", { hasUser: !!user, planId, billingCycle });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Sending checkout request with:", { planId, billingCycle, discountCode });
      
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          billingCycle,
          promoCode,
          couponId,
          discountCode,
        }),
      });

      console.log("Response status:", response.status, "OK:", response.ok);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        const errorMessage = errorData.details 
          ? `${errorData.error}\n\nDetails: ${errorData.details}` 
          : (errorData.error || `Server error: ${response.status}`);
        setError(errorMessage);
        return;
      }
      
      const data = await response.json();
      console.log("Checkout response data:", data);

      if (data.url) {
        // Redirect to Stripe checkout
        console.log("Redirecting to Stripe:", data.url);
        window.location.href = data.url;
      } else {
        console.error("No URL in response:", data);
        const errorMessage = data.details 
          ? `${data.error}\n\nDetails: ${data.details}` 
          : (data.error || "Failed to create checkout session - no URL returned");
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError(`Failed to create checkout session: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  if (!user) return null;
  
  // Don't render if we don't have the required params
  if (!planId || !billingCycle) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">Loading checkout...</div>
          </div>
        </div>
      </div>
    );
  }

  const plan = plans.find((p) => p.id === planId);
  
  // If plans are loaded but plan not found, show error
  if (plans.length > 0 && !plan) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto py-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Plan Not Found</h1>
            <p className="text-muted-foreground">
              The selected plan could not be found. Please try again.
            </p>
            <Link href="/dashboard/upgrade">
              <Button>Back to Plans</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // If plans aren't loaded yet, wait
  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">Loading plan details...</div>
          </div>
        </div>
      </div>
    );
  }

  const originalPrice =
    billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  
  // Calculate discounted price if we have a discount
  const planPrice = discountPercent 
    ? originalPrice * (1 - parseInt(discountPercent) / 100)
    : originalPrice;

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
                <div className="flex items-center gap-2">
                  {discountPercent && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                      {discountPercent}% OFF
                    </Badge>
                  )}
                  <Badge className="bg-secondary text-secondary-foreground">
                    {discountPercent && (
                      <span className="line-through text-muted-foreground mr-2">
                        ${originalPrice}
                      </span>
                    )}
                    ${planPrice.toFixed(planPrice % 1 === 0 ? 0 : 2)}/{billingCycle === "monthly" ? "month" : "year"}
                  </Badge>
                </div>
              </CardTitle>
              {discountCode && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Discount Code Applied: {discountCode}
                  </Badge>
                </div>
              )}
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
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md mb-4 whitespace-pre-wrap">
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
                    Continue to Secure Checkout - ${planPrice.toFixed(planPrice % 1 === 0 ? 0 : 2)}/
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
