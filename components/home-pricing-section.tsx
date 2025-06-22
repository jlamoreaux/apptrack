"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle, Infinity, Crown } from "lucide-react"
import { HOME_PRICING_CONFIG, PRICING_COLORS } from "@/lib/constants/home-pricing"
import { PLAN_NAMES } from "@/lib/constants/plans"

function getFeatureIcon(feature: string, colorClass: string) {
  const lowerFeature = feature.toLowerCase()

  if (lowerFeature.includes("unlimited")) {
    return <Infinity className={`h-4 w-4 ${colorClass}`} />
  }

  return <CheckCircle className={`h-4 w-4 ${colorClass}`} />
}

function PlanCard({ plan }: { plan: (typeof HOME_PRICING_CONFIG.plans)[0] }) {
  const colors = plan.name === PLAN_NAMES.PRO ? PRICING_COLORS.PRO : PRICING_COLORS.FREE
  const isPro = plan.name === PLAN_NAMES.PRO

  return (
    <div
      className={`
      relative p-6 rounded-lg border-2 transition-all duration-200
      ${colors.background} ${colors.border}
      ${isPro ? "ring-2 ring-blue-500 ring-opacity-50 shadow-lg scale-105" : "hover:shadow-md"}
    `}
    >
      {/* Pro badge */}
      {isPro && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div
            className={`
            inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
            ${colors.accent}
          `}
          >
            <Crown className="h-3 w-3 mr-1" />
            Most Popular
          </div>
        </div>
      )}

      {/* Plan header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          {isPro ? (
            <Infinity className={`h-5 w-5 mr-2 ${colors.icon}`} />
          ) : (
            <CheckCircle className={`h-5 w-5 mr-2 ${colors.icon}`} />
          )}
          <h3 className={`font-semibold text-lg ${colors.text}`}>{plan.title}</h3>
        </div>

        <p className={`text-sm mb-4 ${colors.icon}`}>{plan.subtitle}</p>

        {plan.price && (
          <div className={`${colors.text}`}>
            <span className="text-3xl font-bold">${plan.price.amount}</span>
            <span className="text-sm font-normal">/{plan.price.period}</span>
          </div>
        )}
      </div>

      {/* Features list */}
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start">
            {getFeatureIcon(feature, colors.icon)}
            <span className={`ml-2 text-sm ${colors.text}`}>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Link href={plan.cta.href} className="block">
        <Button
          className={`
            w-full transition-all duration-200
            ${
              isPro
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg"
                : "bg-slate-600 hover:bg-slate-700 text-white"
            }
          `}
          size="lg"
        >
          {plan.cta.text}
        </Button>
      </Link>
    </div>
  )
}

export function HomePricingSection() {
  return (
    <section className="mt-16" aria-labelledby="pricing-heading">
      <div className="text-center mb-8">
        <h2 id="pricing-heading" className="text-2xl font-bold mb-2 text-foreground">
          {HOME_PRICING_CONFIG.title}
        </h2>
        <p className="text-muted-foreground">{HOME_PRICING_CONFIG.subtitle}</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-6">
          {HOME_PRICING_CONFIG.plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </div>

      {/* Additional info */}
      <div className="text-center mt-8">
        <p className="text-sm text-muted-foreground">
          Need more features? Check out our{" "}
          <Link href="/dashboard/upgrade" className="text-blue-600 hover:text-blue-700 underline font-medium">
            AI Coach plan
          </Link>{" "}
          for advanced career guidance.
        </p>
      </div>
    </section>
  )
}
