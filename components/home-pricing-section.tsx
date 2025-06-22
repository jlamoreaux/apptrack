"use client"

import Link from "next/link"
import { HOME_PRICING_CONFIG } from "@/lib/constants/home-pricing"
import { PlanCard } from "@/components/shared/plan-card"

export function HomePricingSection() {
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
          {HOME_PRICING_CONFIG.plans.map((plan) => (
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
