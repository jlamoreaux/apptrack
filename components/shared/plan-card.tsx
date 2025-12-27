"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Crown,
  Infinity,
  Heart,
  Bot,
  Sparkles,
  Brain,
  FileText,
  MessageSquare,
  Target,
} from "lucide-react";
import { PLAN_THEMES } from "@/lib/constants/plan-themes";
import { PLAN_NAMES } from "@/lib/constants/plans";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";

const ICON_MAP = {
  check: Check,
  infinity: Infinity,
  heart: Heart,
  brain: Brain,
  "file-text": FileText,
  "message-square": MessageSquare,
  target: Target,
  crown: Crown,
  bot: Bot,
  sparkles: Sparkles,
};

interface PlanCardProps {
  planName: string;
  title: string;
  subtitle: string;
  price?: {
    amount: number;
    originalAmount?: number;
    period: string;
  } | null;
  features: string[];
  cta: {
    text: string;
    href: string;
  };
  isCurrentPlan?: boolean;
  variant?: "home" | "upgrade";
  className?: string;
}

function getFeatureIcon(feature: string): keyof typeof ICON_MAP {
  const lowerFeature = feature.toLowerCase();

  if (lowerFeature.includes("unlimited")) return "infinity";
  if (lowerFeature.includes("ai resume")) return "brain";
  if (lowerFeature.includes("ai interview")) return "message-square";
  if (lowerFeature.includes("ai cover")) return "file-text";
  if (lowerFeature.includes("career advice")) return "target";
  if (lowerFeature.includes("cancel reminder")) return "heart";

  return "check";
}

function renderIcon(iconName: keyof typeof ICON_MAP, className: string) {
  const IconComponent = ICON_MAP[iconName];
  return <IconComponent className={className} />;
}

export function PlanCard({
  planName,
  title,
  subtitle,
  price,
  features,
  cta,
  isCurrentPlan = false,
  variant = "home",
  className = "",
}: PlanCardProps) {
  const theme = PLAN_THEMES[planName as keyof typeof PLAN_THEMES];
  const isUpgradeVariant = variant === "upgrade";
  const isPro = isOnProOrHigher(planName);
  const isAI = planName === PLAN_NAMES.AI_COACH;
  const isFree = planName === PLAN_NAMES.FREE;

  if (!theme) {
    return null;
  }

  const cardContent = (
    <>
      {/* Badge */}
      {theme.badge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
          <Badge className={theme.badge.className}>
            {theme.badge.icon &&
              renderIcon(
                theme.badge.icon as keyof typeof ICON_MAP,
                "h-3 w-3 mr-1"
              )}
            {theme.badge.text}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {title}
            {isCurrentPlan && <Badge variant="secondary">Current</Badge>}
          </CardTitle>
          {isPro && <Infinity className={`h-5 w-5 ${theme.colors.icon}`} />}
          {isAI && <Bot className={`h-5 w-5 ${theme.colors.icon}`} />}
        </div>

        <CardDescription className={theme.colors.muted}>
          {subtitle}
        </CardDescription>

        <div className={`text-2xl font-bold ${theme.colors.text}`}>
          {price ? (
            <>
              {price.originalAmount && (
                <span className="text-sm line-through text-muted-foreground mr-2">
                  ${price.originalAmount}
                </span>
              )}
              ${price.amount}
              <span className={`text-sm font-normal ${theme.colors.muted}`}>
                /{price.period}
              </span>
            </>
          ) : (
            <>
              $0
              <span className={`text-sm font-normal ${theme.colors.muted}`}>
                /month
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col h-full">
        {/* Features list - grows to fill available space */}
        <ul className="space-y-3 flex-grow mb-6">
          {features.map((feature, index) => {
            const iconName = getFeatureIcon(feature);
            return (
              <li key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {renderIcon(iconName, `h-4 w-4 ${theme.colors.icon}`)}
                </div>
                <span
                  className={`text-sm leading-relaxed text-left ${theme.colors.text}`}
                >
                  {feature}
                </span>
              </li>
            );
          })}
        </ul>

        {/* CTA Button - always at bottom */}
        <div className="mt-auto">
          {(isCurrentPlan && isUpgradeVariant) ? (
            <Button
              className={`w-full ${theme.colors.button}`}
              variant={isFree ? "outline" : "default"}
              disabled={true}
              size={isUpgradeVariant ? "default" : "lg"}
            >
              {cta.text}
            </Button>
          ) : (
            <Link href={cta.href} className="block">
              <Button
                className={`w-full ${theme.colors.button}`}
                variant={isFree ? "outline" : "default"}
                size={isUpgradeVariant ? "default" : "lg"}
              >
                {cta.text}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </>
  );

  if (isUpgradeVariant) {
    const isDowngrade = cta.text === "Downgrade";

    return (
      <Card
        className={`
          relative h-full flex flex-col
          ${isCurrentPlan ? "border-primary ring-2 ring-primary/20" : ""}
          ${isDowngrade ? "opacity-60 grayscale" : ""}
          ${theme.colors.background}
          ${theme.colors.border}
          ${className}
        `}
      >
        {cardContent}
      </Card>
    );
  }

  // Home variant with enhanced styling
  return (
    <div
      className={`
        relative h-full flex flex-col p-6 rounded-lg border-2 transition-all duration-200
        ${theme.colors.background}
        ${theme.colors.border}
        ${
          isPro || isAI ? "ring-2 ring-opacity-50 shadow-lg" : "hover:shadow-md"
        }
        ${isPro ? "ring-blue-500" : ""}
        ${isAI ? "ring-amber-500" : ""}
        ${className}
      `}
    >
      {/* Badge */}
      {theme.badge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${theme.badge.className}`}
          >
            {theme.badge.icon &&
              renderIcon(
                theme.badge.icon as keyof typeof ICON_MAP,
                "h-3 w-3 mr-1"
              )}
            {theme.badge.text}
          </div>
        </div>
      )}

      {/* Plan header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          {isAI ? (
            <Bot className={`h-5 w-5 mr-2 ${theme.colors.icon}`} />
          ) : isPro ? (
            <Infinity className={`h-5 w-5 mr-2 ${theme.colors.icon}`} />
          ) : (
            <Check className={`h-5 w-5 mr-2 ${theme.colors.icon}`} />
          )}
          <h3 className={`font-semibold text-lg ${theme.colors.text}`}>
            {title}
          </h3>
        </div>

        <p className={`text-sm mb-4 ${theme.colors.muted}`}>{subtitle}</p>

        <div className={theme.colors.text}>
          {price ? (
            <>
              {price.originalAmount && (
                <span className="text-sm line-through text-muted-foreground mr-2">
                  ${price.originalAmount}
                </span>
              )}
              <span className="text-3xl font-bold">${price.amount}</span>
              <span className="text-sm font-normal">/{price.period}</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-bold">Free</span>
            </>
          )}
        </div>
      </div>

      {/* Features list - grows to fill available space */}
      <ul className="space-y-3 mb-6 flex-grow">
        {features.map((feature, index) => {
          const iconName = getFeatureIcon(feature);
          return (
            <li key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {renderIcon(iconName, `h-4 w-4 ${theme.colors.icon}`)}
              </div>
              <span
                className={`text-sm leading-relaxed text-left ${theme.colors.text}`}
              >
                {feature}
              </span>
            </li>
          );
        })}
      </ul>

      {/* CTA Button - always at bottom */}
      <div className="mt-auto">
        {isCurrentPlan ? (
          <Button
            className={`w-full transition-all duration-200 ${theme.colors.button}`}
            size="lg"
            disabled={true}
          >
            {cta.text}
          </Button>
        ) : (
          <Link href={cta.href} className="block">
            <Button
              className={`w-full transition-all duration-200 ${theme.colors.button}`}
              size="lg"
            >
              {cta.text}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
