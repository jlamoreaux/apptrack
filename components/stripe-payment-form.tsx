"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, CreditCard, Check } from "lucide-react";
import { useRouter } from "next/navigation";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface PaymentFormProps {
  planId: string;
  billingCycle: "monthly" | "yearly";
  userId: string;
  planName: string;
  planPrice: number;
  planFeatures: string[];
}

function CheckoutForm({
  planId,
  billingCycle,
  userId,
  planName,
  planPrice,
  planFeatures,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId,
            billingCycle,
            userId,
          }),
        });

        const data = await response.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error || "Failed to initialize payment");
        }
      } catch (err) {
        setError("Failed to initialize payment");
      }
    };

    createPaymentIntent();
  }, [planId, billingCycle, userId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Payment failed");
      setLoading(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/upgrade/success`,
      },
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed");
      setLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Initializing payment...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{planName} Plan</span>
            <Badge className="bg-secondary text-secondary-foreground">
              ${planPrice}/{billingCycle === "monthly" ? "month" : "year"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {planFeatures.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-secondary" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Secure Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 border rounded-lg">
              <PaymentElement />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!stripe || loading}
              className="w-full bg-secondary hover:bg-secondary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Subscribe to {planName} - ${planPrice}/
                  {billingCycle === "monthly" ? "mo" : "yr"}
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>🔒 Your payment information is secure and encrypted</p>
              <p>You can cancel your subscription at any time</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function StripePaymentForm(props: PaymentFormProps) {
  const options = {
    mode: "setup" as const,
    currency: "usd",
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#10b981", // Using our secondary color
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm {...props} />
    </Elements>
  );
}
