"use client";

import { useState, useEffect } from "react";
import { X, Gift, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import Link from "next/link";
import { clientLogger } from "@/lib/utils/client-logger";
import { LogCategory } from "@/lib/services/logger.types";

interface TrafficSourceBannerProps {
  source: "reddit" | "linkedin" | null;
}

const SOURCE_CONFIG = {
  reddit: {
    title: "Welcome Reddit Users!",
    subtitle: "Get 7 days free of AI Coach",
    description: "Exclusive offer for Reddit community members",
    trialDays: 7,
    trialType: "ai_coach_trial",
    color: "bg-secondary",
    borderColor: "border-secondary",
  },
  linkedin: {
    title: "Welcome LinkedIn Professionals!",
    subtitle: "Get 7 days free of AI Coach", 
    description: "Exclusive offer for LinkedIn network",
    trialDays: 7,
    trialType: "ai_coach_trial",
    color: "bg-secondary",
    borderColor: "border-secondary",
  },
};

export function TrafficSourceBanner({ source }: TrafficSourceBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (source && SOURCE_CONFIG[source]) {
      // Check if user has already dismissed this banner
      const dismissedKey = `traffic_banner_dismissed_${source}`;
      const isDismissed = localStorage.getItem(dismissedKey) === "true";
      
      if (!isDismissed) {
        setIsVisible(true);
        
        clientLogger.info("Traffic source banner displayed", {
          category: LogCategory.BUSINESS,
          action: "traffic_source_banner_shown",
          metadata: {
            source,
            trialDays: SOURCE_CONFIG[source].trialDays,
            trialType: SOURCE_CONFIG[source].trialType,
          }
        });
      }
    }
  }, [source]);

  const handleDismiss = () => {
    if (source) {
      localStorage.setItem(`traffic_banner_dismissed_${source}`, "true");
      setDismissed(true);
      
      clientLogger.info("Traffic source banner dismissed", {
        category: LogCategory.BUSINESS,
        action: "traffic_source_banner_dismissed",
        metadata: { source }
      });
      
      setTimeout(() => setIsVisible(false), 300);
    }
  };

  const handleCTAClick = () => {
    if (source) {
      clientLogger.info("Traffic source banner CTA clicked", {
        category: LogCategory.BUSINESS,
        action: "traffic_source_banner_cta_clicked",
        metadata: {
          source,
          trialDays: SOURCE_CONFIG[source].trialDays,
          trialType: SOURCE_CONFIG[source].trialType,
        }
      });
      
      // Store the traffic source and trial info in session storage for signup flow
      sessionStorage.setItem("traffic_source", source);
      sessionStorage.setItem("traffic_source_trial", JSON.stringify({
        days: SOURCE_CONFIG[source].trialDays,
        type: SOURCE_CONFIG[source].trialType
      }));
    }
  };

  if (!source || !isVisible || !SOURCE_CONFIG[source]) return null;

  const config = SOURCE_CONFIG[source];

  return (
    <div 
      className={`
        relative overflow-hidden transition-all duration-300
        ${dismissed ? "opacity-0 h-0" : "opacity-100"}
      `}
    >
      <div className={`${config.color} border-b ${config.borderColor}`}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Gift className="h-5 w-5 text-secondary-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary-foreground">
                  {config.title}
                </p>
                <p className="text-xs text-secondary-foreground/90">
                  {config.subtitle} • {config.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <ButtonLink 
                href="/signup?intent=ai-coach-trial" 
                size="sm" 
                className="whitespace-nowrap"
                onClick={handleCTAClick}
              >
                <Timer className="h-4 w-4 mr-2" />
                Claim Your Trial
              </ButtonLink>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}