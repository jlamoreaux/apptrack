"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Crown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { trackConversionEvent } from "@/lib/analytics/conversion-events";
import copyData from "@/content/copy.json";

const AI_COACH_PRICE = copyData.pricing.plans.ai_coach.price;

interface UpgradePromptProps {
  variant?: "inline" | "card" | "banner";
  title?: string;
  description?: string;
  buttonText?: string;
  feature?: string;
  className?: string;
}

export function UpgradePrompt({
  variant = "card",
  title = "Unlock AI-Powered Features",
  description = `Get unlimited applications, AI resume analysis, custom cover letters, and interview prep for just ${AI_COACH_PRICE}.`,
  buttonText = "Upgrade to AI Coach",
  feature,
  className = "",
}: UpgradePromptProps) {
  const handleClick = () => {
    trackConversionEvent("upgrade_prompt_clicked", {
      variant,
      feature: feature || "general",
      location: window.location.pathname,
    });
  };

  if (variant === "inline") {
    return (
      <div className={`flex items-center justify-between p-4 bg-secondary/10 rounded-lg ${className}`}>
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-secondary" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <Link href="/dashboard/upgrade">
          <Button size="sm" variant="secondary" onClick={handleClick}>
            {buttonText}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={`bg-gradient-to-r from-secondary/20 to-secondary/10 p-6 rounded-lg ${className}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Crown className="h-6 w-6 text-secondary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
          <Link href="/dashboard/upgrade" className="flex-shrink-0">
            <Button variant="secondary" onClick={handleClick}>
              {buttonText}
              <Sparkles className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Sparkles className="h-6 w-6 text-secondary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/dashboard/upgrade" className="block">
          <Button className="w-full" variant="secondary" onClick={handleClick}>
            {buttonText}
            <Crown className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}