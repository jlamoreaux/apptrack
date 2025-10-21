"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AIFeatureLockedOverlay } from "./ai-feature-locked-overlay";
import { AIFeaturePreview } from "./ai-feature-preview";
import { cn } from "@/lib/utils";

export interface AIFeatureTeaserProps {
  feature: string;
  previewContent: React.ReactNode;
  className?: string;
  onUpgradeClick?: () => void;
  trackingId?: string;
}

export function AIFeatureTeaser({
  feature,
  previewContent,
  className,
  onUpgradeClick,
  trackingId,
}: AIFeatureTeaserProps) {
  // Track teaser view
  useEffect(() => {
    if (window.posthog && trackingId) {
      window.posthog.capture("ai_feature_teaser_viewed", {
        feature: feature,
        teaser_id: trackingId,
        location: window.location.pathname,
      });
    }
  }, [feature, trackingId]);

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <AIFeatureLockedOverlay 
        feature={feature} 
        onUpgradeClick={onUpgradeClick}
      />
      <AIFeaturePreview>
        {previewContent}
      </AIFeaturePreview>
    </Card>
  );
}