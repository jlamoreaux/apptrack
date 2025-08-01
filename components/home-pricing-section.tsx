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

      <div className="max-w-6xl mx-auto">
        {/* Grid with uniform heights and consistent widths */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-6 auto-rows-fr">
          {planData.map((plan, index) => {
            const isThirdCard = planData.length === 3 && index === 2

            return (
              <div
                key={plan.name}
                className={`
                  flex w-full
                  ${isThirdCard ? "md:col-span-2 xl:col-span-1" : ""}
                `}
              >
                <div
                  className={`
                    flex w-full
                    ${isThirdCard ? "md:justify-center xl:justify-stretch" : ""}
                  `}
                >
                  <PlanCard
                    planName={plan.name}
                    title={plan.title}
                    subtitle={plan.subtitle}
                    price={plan.price}
                    features={plan.features}
                    cta={plan.cta}
                    variant="home"
                    className={`
                      ${isThirdCard ? "md:w-full md:max-w-sm xl:max-w-none" : "w-full"}
                    `}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Additional info */}
      <div className="text-center mt-8">
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
