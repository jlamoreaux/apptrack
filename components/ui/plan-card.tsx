"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  Infinity,
  Crown,
  Sparkles,
  Bot,
  Heart,
  Brain,
  FileText,
  MessageSquare,
  Target,
  Check,
} from "lucide-react"
import { PLAN_THEMES } from "@/lib/constants/plan-themes"
import { PLAN_NAMES } from "@/lib/constants/plans"

const ICON_MAP = {
  check: Check,
  "check-circle": CheckCircle,
  infinity: Infinity,
  heart: Heart,
  brain: Brain,
  "file-text": FileText,
  "message-square": MessageSquare,
  target: Target,
  crown: Crown,
  bot: Bot,
  sparkles: Sparkles,
} as const

interface PlanCardProps {
  plan: {
    name: string
    title: string
    subtitle: string
    price?: {
      amount: number
      period: string
    } | null
    features: string[]
    cta: {
      text: string
      href: string
    }
    highlight?: boolean
  }
  variant?: "home" | "upgrade"
  isCurrentPlan?: boolean
  onUpgrade?: () => void
}

function getFeatureIcon(feature: string): keyof typeof ICON_MAP {
  const lowerFeature = feature.toLowerCase()

  if (lowerFeature.includes("unlimited")) return "infinity"
  if (lowerFeature.includes("ai resume")) return "brain"
  if (lowerFeature.includes("ai interview")) return "message-square"
  if (lowerFeature.includes("ai cover")) return "file-text"
  if (lowerFeature.includes("career advice")) return "target"
  if (lowerFeature.includes("cancel reminder")) return "heart"
  if (lowerFeature.includes("everything in")) return "check"

  return "check"
}

export function PlanCard({ plan, variant = "home", isCurrentPlan = false, onUpgrade }: PlanCardProps) {
  const theme = PLAN_THEMES[plan.name as keyof typeof PLAN_THEMES]
  const isHighlighted = plan.highlight || isCurrentPlan

  if (!theme) {
    console.warn(`No theme found for plan: ${plan.name}`)
    return null
  }

  const cardClasses = `
    relative p-6 rounded-lg border-2 transition-all duration-200
    ${theme.card.background} ${theme.card.border}
    ${isHighlighted ? theme.card.highlight || theme.card.hover : theme.card.hover}
  `.trim()

  return (
    <div className={cardClasses}>
      {/* Badge for highlighted plans */}
      {theme.badge && plan.highlight && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className={theme.badge.background}>
            {theme.badge.icon && (
              <>{ICON_MAP[theme.badge.icon as keyof typeof ICON_MAP]({ className: "h-3 w-3 mr-1" })}</>
            )}
            {theme.badge.text}
          </Badge>
        </div>
      )}

      {/* Plan header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          {plan.name === PLAN_NAMES.PRO && <Infinity className={`h-5 w-5 mr-2 ${theme.icon}`} />}
          {plan.name === PLAN_NAMES.AI_COACH && <Bot className={`h-5 w-5 mr-2 ${theme.icon}`} />}
          {plan.name === PLAN_NAMES.FREE && <CheckCircle className={`h-5 w-5 mr-2 ${theme.icon}`} />}

          <h3 className={`font-semibold text-lg ${theme.text.primary}`}>
            {plan.title}
            {isCurrentPlan && (
              <Badge variant="secondary" className="ml-2">
                Current
              </Badge>
            )}
          </h3>
        </div>

        <p className={`text-sm mb-4 ${theme.text.secondary}`}>{plan.subtitle}</p>

        <div className={`${theme.text.primary}`}>
          {plan.price ? (
            <>
              <span className="text-3xl font-bold">${plan.price.amount}</span>
              <span className="text-sm font-normal">/{plan.price.period}</span>
            </>
          ) : (
            <span className="text-2xl font-bold">Free</span>
          )}
        </div>
      </div>

      {/* Features list */}
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, index) => {
          const iconName = getFeatureIcon(feature)
          const IconComponent = ICON_MAP[iconName]

          return (
            <li key={index} className="flex items-start">
              <IconComponent className={`h-4 w-4 mt-0.5 mr-2 flex-shrink-0 ${theme.icon}`} />
              <span className={`text-sm ${theme.text.primary}`}>{feature}</span>
            </li>
          )
        })}
      </ul>

      {/* CTA Button */}
      {variant === "upgrade" && onUpgrade ? (
        <Button
          onClick={onUpgrade}
          disabled={isCurrentPlan || plan.name === PLAN_NAMES.FREE}
          className={`w-full ${isCurrentPlan || plan.name === PLAN_NAMES.FREE ? theme.button.outline : theme.button.primary}`}
          variant={isCurrentPlan || plan.name === PLAN_NAMES.FREE ? "outline" : "default"}
        >
          {isCurrentPlan ? "Current Plan" : plan.name === PLAN_NAMES.FREE ? "Downgrade" : plan.cta.text}
        </Button>
      ) : (
        <Link href={plan.cta.href} className="block">
          <Button className={`w-full ${theme.button.primary}`} size="lg">
            {plan.cta.text}
          </Button>
        </Link>
      )}
    </div>
  )
}
