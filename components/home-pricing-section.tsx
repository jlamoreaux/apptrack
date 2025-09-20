"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { COPY, getPlanCopy } from "@/lib/content/copy"
import { PLAN_NAMES } from "@/lib/constants/plans"
import { PlanCard } from "@/components/shared/plan-card"
import { getHomePlanData } from "@/lib/utils/plan-helpers"
import type { SubscriptionPlan } from "@/lib/supabase"

interface HomePricingSectionProps {
  plans?: SubscriptionPlan[]
}

export function HomePricingSection({ plans = [] }: HomePricingSectionProps) {
  const [planData, setPlanData] = useState<any[]>([])

  useEffect(() => {
    // Get plan configuration from centralized copy
    const planConfigs = [
      { name: PLAN_NAMES.FREE, ...getPlanCopy(PLAN_NAMES.FREE) },
      { name: PLAN_NAMES.PRO, ...getPlanCopy(PLAN_NAMES.PRO) },
      { name: PLAN_NAMES.AI_COACH, ...getPlanCopy(PLAN_NAMES.AI_COACH) },
    ].filter(Boolean)

    if (plans.length > 0) {
      // Merge database plans with copy configuration
      const mergedPlans = planConfigs
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
      // Fallback to copy configuration
      setPlanData(planConfigs)
    }
  }, [plans])

  return (
    <section className="mt-16" aria-labelledby="pricing-heading">
      <div className="text-center mb-8">
        <h2 id="pricing-heading" className="text-2xl font-bold mb-2 text-foreground">
          {COPY.pricing.title}
        </h2>
        <p className="text-muted-foreground">{COPY.pricing.subtitle}</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Simplified responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 auto-rows-fr">
          {planData.map((plan) => (
            <div key={plan.name} className="flex w-full">
              <PlanCard
                planName={plan.name}
                title={plan.title}
                subtitle={plan.subtitle}
                price={plan.price}
                features={plan.features}
                cta={plan.cta}
                variant="home"
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Ethical Promise */}
      <div className="text-center mt-8 p-4 bg-primary/5 rounded-lg max-w-2xl mx-auto">
        <p className="text-sm font-medium text-foreground">
          🎯 {COPY.pricing.ethicalPromise}
        </p>
      </div>

      {/* Additional info */}
      <div className="text-center mt-4">
        <p className="text-sm text-muted-foreground">
          {COPY.pricing.footer}{" "}
          <Link href="/dashboard/upgrade" className="text-blue-600 hover:text-blue-700 underline font-medium">
            Compare all features
          </Link>{" "}
          to find the perfect fit.
        </p>
      </div>
    </section>
  )
}
