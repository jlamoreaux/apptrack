"use client";

import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/lib/utils/navigation";
import { cn } from "@/lib/utils";
import { AI_THEME } from "@/lib/constants/ai-theme";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

interface AIFeatureLockedOverlayProps {
  feature: string;
  className?: string;
  onUpgradeClick?: () => void;
}

export function AIFeatureLockedOverlay({
  feature,
  className,
  onUpgradeClick,
}: AIFeatureLockedOverlayProps) {
  const { navigateToUpgrade } = useNavigation();

  const handleClick = () => {
    capturePostHogEvent("ai_feature_unlock_clicked", {
      feature: feature,
      location: "teaser_overlay",
    });

    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      navigateToUpgrade();
    }
  };

  return (
    <div
      className={cn(
        "absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center",
        className
      )}
    >
      <div className="text-center p-6 max-w-sm">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <Crown className={`h-5 w-5 ${AI_THEME.classes.text.primary} absolute -top-1 -right-1`} />
          </div>
        </div>
        
        <h3 className="font-semibold text-lg mb-2">
          Unlock {feature} with AI Coach
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4">
          Get instant AI-powered insights to accelerate your job search
        </p>
        
        <Button 
          onClick={handleClick} 
          size="sm"
          className={AI_THEME.getButtonClasses("primary")}
        >
          <Crown className="h-4 w-4 mr-1" />
          Upgrade to AI Coach
        </Button>
      </div>
    </div>
  );
}