"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Crown,
  CreditCard,
  Calendar,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { UserSubscription } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface SubscriptionManagementProps {
  userId: string;
  subscription: UserSubscription | null;
}

export function SubscriptionManagement({
  userId,
  subscription,
}: SubscriptionManagementProps) {
  const [loading, setLoading] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const isOnFreePlan =
    subscription?.subscription_plans?.name === "Free" || !subscription;
  const isActive = subscription?.status === "active";

  const handleCancelSubscription = async () => {
    if (!subscription || !subscription.stripe_subscription_id) return;

    setLoadingCancel(true);
    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(
          "Your subscription has been canceled. You'll continue to have access until the end of your billing period."
        );
        setSuccessModalOpen(true);
      } else {
        setErrorMessage(
          "Failed to cancel subscription. Please contact support."
        );
        setErrorModalOpen(true);
      }
    } catch (error) {
      setErrorMessage(
        "Something went wrong. Please try again or contact support."
      );
      setErrorModalOpen(true);
    } finally {
      setLoadingCancel(false);
      setConfirmCancelOpen(false);
    }
  };

  const handleManageBilling = async () => {
    setLoadingBilling(true);
    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMessage(
          data.error || "Failed to open billing portal. Please contact support."
        );
        setErrorModalOpen(true);
      }
    } catch (error) {
      setErrorMessage(
        "Something went wrong. Please try again or contact support."
      );
      setErrorModalOpen(true);
    } finally {
      setLoadingBilling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {!isOnFreePlan && <Crown className="h-5 w-5 text-secondary" />}
            <div>
              <h3 className="font-semibold">
                {subscription?.subscription_plans?.name || "Free"} Plan
              </h3>
              <p className="text-sm text-muted-foreground">
                {isOnFreePlan
                  ? "Up to 100 applications"
                  : "Unlimited applications"}
              </p>
            </div>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>
            {subscription?.status || "active"}
          </Badge>
        </div>
        <div className="text-right">
          <p className="font-semibold">
            {isOnFreePlan
              ? "$0/month"
              : subscription?.billing_cycle === "yearly"
              ? `$${subscription?.subscription_plans?.price_yearly}/year`
              : `$${subscription?.subscription_plans?.price_monthly}/month`}
          </p>
          {!isOnFreePlan && subscription?.current_period_end && (
            <p className="text-xs text-muted-foreground">
              Renews{" "}
              {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Plan Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {subscription?.subscription_plans?.features.map(
              (feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full" />
                  {feature}
                </li>
              )
            )}
            <li className="flex items-center gap-2 text-sm">
              <div className="w-1.5 h-1.5 bg-secondary rounded-full" />
              {isOnFreePlan ? "Up to 100 applications" : "Unlimited applications"}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        {isOnFreePlan ? (
          <Link href="/dashboard/upgrade" className="flex-1">
            <Button className="w-full bg-secondary hover:bg-secondary/90">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </Link>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleManageBilling}
              className="flex-1"
              disabled={loadingBilling}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {loadingBilling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening Billing...
                </>
              ) : (
                <>
                  Manage Billing
                  <ExternalLink className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            {subscription?.status === "canceled" ||
            (subscription?.cancel_at_period_end &&
              (subscription?.status === "active" ||
                subscription?.status === "trialing")) ? (
              <Link href="/dashboard/upgrade" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Reactivate Subscription
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={loadingCancel}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                {loadingCancel ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Cancel Subscription
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Pending Cancellation Banner */}
      {subscription &&
        subscription.cancel_at_period_end &&
        subscription.status !== "canceled" &&
        (subscription.status === "active" ||
          subscription.status === "trialing") && (
          <div className="p-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
            Your subscription will end on{" "}
            {subscription.current_period_end
              ? new Date(subscription.current_period_end).toLocaleDateString()
              : "the end of your billing period"}
            . You will retain access until then. You can reactivate your
            subscription at any time before this date.
          </div>
        )}

      {subscription?.status === "canceled" &&
        subscription?.current_period_end && (
          <div className="p-3 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-md">
            Your subscription is canceled and will end on{" "}
            {new Date(subscription.current_period_end).toLocaleDateString()}.
            You can still upgrade to reactivate your subscription.
          </div>
        )}

      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setErrorModalOpen(false)}
              autoFocus
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You will keep
              access until the end of your current billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setConfirmCancelOpen(false)}
              autoFocus
              disabled={loadingCancel}
              className="hover:bg-muted"
            >
              No, Keep Subscription
            </AlertDialogAction>
            <Button
              variant="outline"
              onClick={handleCancelSubscription}
              disabled={loadingCancel}
              className="border-red-200 text-red-600 hover:bg-red-600 hover:text-white"
            >
              {loadingCancel ? "Canceling..." : "Yes, Cancel Subscription"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Subscription Canceled</AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setSuccessModalOpen(false)}
              autoFocus
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
