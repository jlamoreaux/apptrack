"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { useDashboardFlags } from "@/components/providers/dashboard-flags-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ApplicationUsageDisplayProps {
  currentCount: number;
  limit: number;
  className?: string;
  variant?: "default" | "compact" | "detailed";
}

export function ApplicationUsageDisplay({
  currentCount,
  limit,
  className,
  variant = "default",
}: ApplicationUsageDisplayProps) {
  const percentage = (currentCount / limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = currentCount >= limit;
  const { isAuditEnabled } = useDashboardFlags();

  if (variant === "compact") {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {currentCount} of {limit} applications
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Application Usage</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">
                    Free accounts can track up to {limit} job applications. 
                    Upgrade to AI Coach for unlimited tracking plus AI-powered features.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="space-y-2">
            <Progress
              value={percentage}
              className={cn(
                "h-2",
                isAtLimit && (isAuditEnabled ? "bg-destructive/10" : "bg-red-100"),
                isNearLimit && !isAtLimit && (isAuditEnabled ? "bg-warning/10" : "bg-orange-100")
              )}
            />

            <div className="flex items-center justify-between text-sm">
              <span className={cn(
                "font-medium",
                isAtLimit && (isAuditEnabled ? "text-destructive" : "text-red-600"),
                isNearLimit && !isAtLimit && (isAuditEnabled ? "text-warning-foreground" : "text-orange-600")
              )}>
                {currentCount} / {limit} applications used
              </span>
              <span className="text-muted-foreground">
                {limit - currentCount} remaining
              </span>
            </div>
          </div>
          
          {isNearLimit && !isAtLimit && (
            <p className={`text-xs mt-2 ${isAuditEnabled ? "text-warning-foreground" : "text-orange-600"}`}>
              You&apos;re approaching your application limit. Consider upgrading for unlimited tracking.
            </p>
          )}

          {isAtLimit && (
            <p className={`text-xs mt-2 ${isAuditEnabled ? "text-destructive" : "text-red-600"}`}>
              You've reached your application limit. Upgrade to continue tracking new applications.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Applications</span>
        <span className={cn(
          "font-medium",
          isAtLimit && (isAuditEnabled ? "text-destructive" : "text-red-600"),
          isNearLimit && !isAtLimit && (isAuditEnabled ? "text-warning-foreground" : "text-orange-600")
        )}>
          {currentCount} / {limit}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className="h-1.5"
        aria-label={`${currentCount} of ${limit} applications used`}
      />
    </div>
  );
}