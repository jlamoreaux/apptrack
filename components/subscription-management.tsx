"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Crown, CreditCard, Calendar, Loader2, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { UserSubscription } from "@/lib/supabase"

interface SubscriptionManagementProps {
  userId: string
  subscription: UserSubscription | null
}

export function SubscriptionManagement({ userId, subscription }: SubscriptionManagementProps) {
  const [loading, setLoading] = useState(false)

  const isOnFreePlan = subscription?.subscription_plans?.name === "Free" || !subscription
  const isActive = subscription?.status === "active"

  const handleCancelSubscription = async () => {
    if (!subscription || !subscription.stripe_subscription_id) return

    setLoading(true)
    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(
          "Your subscription has been canceled. You'll continue to have access until the end of your billing period.",
        )
        window.location.reload()
      } else {
        alert("Failed to cancel subscription. Please contact support.")
      }
    } catch (error) {
      console.error("Error canceling subscription:", error)
      alert("Something went wrong. Please try again or contact support.")
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = () => {
    // In a real app, you'd redirect to Stripe Customer Portal
    alert("Billing management portal would open here. This requires additional Stripe setup.")
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {!isOnFreePlan && <Crown className="h-5 w-5 text-secondary" />}
            <div>
              <h3 className="font-semibold">{subscription?.subscription_plans?.name || "Free"} Plan</h3>
              <p className="text-sm text-muted-foreground">
                {isOnFreePlan ? "Up to 5 applications" : "Unlimited applications"}
              </p>
            </div>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>{subscription?.status || "active"}</Badge>
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
              Renews {new Date(subscription.current_period_end).toLocaleDateString()}
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
            {subscription?.subscription_plans?.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-secondary rounded-full" />
                {feature}
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm">
              <div className="w-1.5 h-1.5 bg-secondary rounded-full" />
              {isOnFreePlan ? "Up to 5 applications" : "Unlimited applications"}
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
              Upgrade to Pro
            </Button>
          </Link>
        ) : (
          <>
            <Button variant="outline" onClick={handleManageBilling} className="flex-1">
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Billing
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelSubscription}
              disabled={loading || subscription?.status === "canceled"}
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  {subscription?.status === "canceled" ? "Canceled" : "Cancel Subscription"}
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {subscription?.status === "canceled" && subscription?.current_period_end && (
        <div className="p-3 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-md">
          Your subscription is canceled and will end on {new Date(subscription.current_period_end).toLocaleDateString()}
          . You can still upgrade to reactivate your subscription.
        </div>
      )}
    </div>
  )
}
