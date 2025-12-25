"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, Crown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/lib/utils/navigation";
import { cn } from "@/lib/utils";
import { AI_THEME } from "@/lib/constants/ai-theme";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

interface AIUpgradeBannerProps {
  className?: string;
  variant?: "default" | "compact";
}

const BANNER_MESSAGES = [
  {
    icon: Sparkles,
    title: "Get AI-powered resume feedback",
    subtitle: "Upgrade to AI Coach for instant analysis",
  },
  {
    icon: TrendingUp,
    title: "See your Job Fit Score with AI analysis",
    subtitle: "Know your chances before applying",
  },
  {
    icon: Crown,
    title: "3x more interviews with AI coaching",
    subtitle: "Join successful job seekers using AI",
  },
];

const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function AIUpgradeBanner({ className, variant = "default" }: AIUpgradeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const { navigateToUpgrade } = useNavigation();

  useEffect(() => {
    // Check if banner was dismissed recently
    const dismissedAt = localStorage.getItem("ai-banner-dismissed");
    if (dismissedAt) {
      const dismissTime = new Date(dismissedAt).getTime();
      const now = new Date().getTime();
      if (now - dismissTime < DISMISS_DURATION) {
        return;
      }
    }

    // Show banner after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true);

      // Track banner impression
      capturePostHogEvent("ai_upgrade_banner_shown", {
        message: BANNER_MESSAGES[messageIndex].title,
        variant,
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [messageIndex, variant]);

  useEffect(() => {
    // Rotate messages every 10 seconds
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % BANNER_MESSAGES.length);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("ai-banner-dismissed", new Date().toISOString());
    capturePostHogEvent("ai_upgrade_banner_dismissed");
  };

  const handleUpgradeClick = () => {
    capturePostHogEvent("ai_upgrade_banner_clicked", {
      message: BANNER_MESSAGES[messageIndex].title,
    });
    navigateToUpgrade();
  };

  if (!isVisible) return null;

  const message = BANNER_MESSAGES[messageIndex];
  const Icon = message.icon;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          `fixed bottom-4 right-4 max-w-sm ${AI_THEME.classes.background.gradient} text-white rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-5`,
          className
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{message.title}</p>
            <p className="text-xs text-amber-50/90 mt-0.5">{message.subtitle}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-amber-100/80 hover:text-white transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className={`w-full mt-3 ${AI_THEME.classes.button.secondary}`}
          onClick={handleUpgradeClick}
        >
          <Crown className="h-3 w-3 mr-1" />
          Upgrade to AI Coach
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        `relative overflow-hidden ${AI_THEME.classes.background.gradient} text-white`,
        className
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base">{message.title}</p>
              <p className="text-xs sm:text-sm text-amber-50/90">{message.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className={AI_THEME.classes.button.secondary}
              onClick={handleUpgradeClick}
            >
              <Crown className="h-4 w-4 mr-1 hidden sm:inline" />
              Upgrade Now
            </Button>
            <button
              onClick={handleDismiss}
              className="text-amber-100/80 hover:text-white transition-colors p-1"
              aria-label="Dismiss banner"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -inset-40 bg-gradient-to-r from-amber-400/50 to-orange-400/50 blur-3xl animate-pulse" />
      </div>
    </div>
  );
}