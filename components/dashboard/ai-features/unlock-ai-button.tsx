"use client";

import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/lib/utils/navigation";
import { cn } from "@/lib/utils";
import { AI_THEME } from "@/lib/constants/ai-theme";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

interface UnlockAIButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
  feature?: string;
  onClick?: () => void;
}

export function UnlockAIButton({
  variant = "default",
  size = "default",
  className,
  children = "Unlock AI Analysis",
  feature,
  onClick,
}: UnlockAIButtonProps) {
  const { navigateToUpgrade } = useNavigation();

  const handleClick = () => {
    capturePostHogEvent("unlock_ai_button_clicked", {
      feature: feature,
      location: typeof window !== "undefined" ? window.location.pathname : undefined,
      button_text: children,
    });

    if (onClick) {
      onClick();
    } else {
      navigateToUpgrade();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(
        variant === "default" && AI_THEME.getButtonClasses("primary"),
        className
      )}
    >
      <Sparkles className="h-4 w-4 mr-1.5" />
      {children}
      <Crown className="h-3.5 w-3.5 ml-1" />
    </Button>
  );
}