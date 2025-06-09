"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { NavigationClient } from "@/components/navigation-client"
import { StripePaymentForm } from "@/components/stripe-payment-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { useSubscription } from "@/hooks/use-subscription"

function CheckoutContent() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const { plans, loading: subLoading } = useSubscription(user?.id || null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const planId = searchParams.get("planId")
  const billingCycle = searchParams.get("billingCycle") as "monthly" | "yearly"

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!planId || !billingCycle) {
      router.push("/dashboard/upgrade")
    }
  }, [planId, billingCycle, router])

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

  if (!user || !planId || !billingCycle) return null

  const plan = plans.find((p) => p.id === planId)
  if (!plan) {
    router.push("/dashboard/upgrade")
    return null
  }

  const planPrice = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly

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
            <h1 className="text-3xl font-bold text-primary">Complete Your Subscription</h1>
            <p className="text-muted-foreground">
              {"You're"} upgrading to the <span className="font-semibold">{plan.name}</span> plan
            </p>
          </div>

          <StripePaymentForm
            planId={planId}
            billingCycle={billingCycle}
            userId={user.id}
            planName={plan.name}
            planPrice={planPrice}
            planFeatures={plan.features}
          />
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
