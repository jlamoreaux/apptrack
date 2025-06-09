"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { NavigationClient } from "@/components/navigation-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Check, Crown, Infinity, Heart } from "lucide-react"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { useSubscription } from "@/hooks/use-subscription"

export default function UpgradePage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const { subscription, usage, plans, loading: subLoading } = useSubscription(user?.id || null)
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">("yearly")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const handleUpgrade = async (planId: string, billingCycle: "monthly" | "yearly") => {
    if (!user) return

    // Redirect to our custom checkout page
    router.push(`/dashboard/upgrade/checkout?planId=${planId}&billingCycle=${billingCycle}`)
  }

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
    )
  }

  if (!user) return null

  const freePlan = plans.find((plan) => plan.name === "Free")
  const proPlan = plans.find((plan) => plan.name === "Pro")
  const currentPlan = subscription?.subscription_plans

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-primary">Upgrade Your Plan</h1>
            <p className="text-muted-foreground">
              {"You're currently using "}
              <span className="font-semibold">{usage?.applications_count || 0}</span>
              {" out of "}
              <span className="font-semibold">{currentPlan?.max_applications}</span>
              {" applications on the "}
              <span className="font-semibold">{currentPlan?.name}</span> plan.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center">
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
                  Save 17%
                </Badge>
              </Button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card className={`relative ${currentPlan?.name === "Free" ? "border-primary" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    Free
                    {currentPlan?.name === "Free" && <Badge variant="secondary">Current</Badge>}
                  </CardTitle>
                </div>
                <CardDescription>Perfect for getting started</CardDescription>
                <div className="text-lg font-medium">Always free</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Up to {freePlan?.max_applications || 5} applications</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Application tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Interview notes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Contact management</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  {currentPlan?.name === "Free" ? "Current Plan" : "Downgrade"}
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className={`relative ${currentPlan?.name === "Pro" ? "border-primary" : "border-secondary/50"}`}>
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-secondary text-secondary-foreground">
                  <Crown className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    Pro
                    {currentPlan?.name === "Pro" && <Badge variant="secondary">Current</Badge>}
                  </CardTitle>
                  <Infinity className="h-5 w-5 text-secondary" />
                </div>
                <CardDescription>For serious job seekers</CardDescription>
                <div className="text-3xl font-bold">
                  ${selectedBilling === "monthly" ? proPlan?.price_monthly : proPlan?.price_yearly}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{selectedBilling === "monthly" ? "month" : "year"}
                  </span>
                </div>
                {selectedBilling === "yearly" && <p className="text-sm text-secondary">Save $4 per year!</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Infinity className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Unlimited applications</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-secondary" />
                    <span className="text-sm">All Free plan features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Cancel reminder when hired</span>
                  </li>
                </ul>
                <Button
                  className="w-full bg-secondary hover:bg-secondary/90"
                  onClick={() => proPlan && handleUpgrade(proPlan.id, selectedBilling)}
                  disabled={currentPlan?.name === "Pro"}
                >
                  {currentPlan?.name === "Pro" ? "Current Plan" : "Upgrade to Pro"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Section */}
          <div className="mt-12 space-y-6">
            <h2 className="text-2xl font-bold text-center text-primary">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Can I cancel anytime?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Yes! You can cancel your subscription at any time. {"We'll"} even remind you to cancel when you mark
                    a job as {"'Offer'"} to help you save money.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">What happens to my data?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your data is always yours. Even if you downgrade to the free plan, {"you'll"} keep access to your
                    first 5 applications and all your notes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
