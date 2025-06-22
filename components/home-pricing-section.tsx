"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { HOME_PRICING_CONFIG } from "@/lib/constants/home-pricing"
import { PlanCard } from "@/components/shared/plan-card"
import { getHomePlanData } from "@/lib/utils/plan-helpers"
import type { SubscriptionPlan } from "@/lib/supabase"

interface HomePricingSectionProps {
  plans?: SubscriptionPlan[]
}

export function HomePricingSection({ plans = [] }: HomePricingSectionProps) {
  const [planData, setPlanData] = useState<any[]>([])

  useEffect(() => {
    if (plans.length > 0) {
      // Merge database plans with home page configuration
      const mergedPlans = HOME_PRICING_CONFIG.planConfig
        .map((config) => {
          const dbPlan = plans.find((p) => p.name === config.name)
          if (dbPlan) {
            return getHomePlanData(dbPlan, config)
          }
          return config
        })
        .filter(Boolean)

      setPlanData(mergedPlans)
    } else {
      // Fallback to config if no database plans available
      setPlanData(HOME_PRICING_CONFIG.planConfig)
    }
  }, [plans])

  return (
    <section className="mt-16" aria-labelledby="pricing-heading">
      <div className="text-center mb-8">
        <h2 id="pricing-heading" className="text-2xl font-bold mb-2 text-foreground">
          {HOME_PRICING_CONFIG.title}
        </h2>
        <p className="text-muted-foreground">{HOME_PRICING_CONFIG.subtitle}</p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-6">
          {planData.map((plan) => (
            <PlanCard
              key={plan.name}
              planName={plan.name}
              title={plan.title}
              subtitle={plan.subtitle}
              price={plan.price}
              features={plan.features}
              cta={plan.cta}
              variant="home"
            />
          ))}
        </div>
      </div>

      {/* Additional info */}
      <div className="text-center mt-8">
        <p className="text-sm text-muted-foreground">
          All plans include our core job tracking features.{" "}
          <Link href="/dashboard/upgrade" className="text-blue-600 hover:text-blue-700 underline font-medium">
            Compare all features
          </Link>{" "}
          to find the perfect fit.
        </p>
      </div>
    </section>
  )
}
