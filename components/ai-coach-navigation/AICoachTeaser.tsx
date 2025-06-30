"use client";

import { useEffect } from "react";
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
  Brain,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Crown,
} from "lucide-react";
import { 
  AI_COACH_COLORS, 
  NAVIGATION_URLS,
  APPLICATION_LIMITS 
} from "@/lib/constants/navigation";
import { UI_CONSTANTS } from "@/lib/constants/ui";
import { APP_ROUTES } from "@/lib/constants/routes";
import { aiCoachAnalytics } from "@/lib/analytics";
import type { Application, PermissionLevel } from "@/types";

interface AICoachTeaserProps {
  userPlan: PermissionLevel;
  recentApplications?: Application[];
  className?: string;
  userId?: string;
}

/**
 * Teaser component to promote AI Coach features to non-subscribers
 * Shows upgrade prompts and preview functionality
 */
export function AICoachTeaser({ 
  userPlan, 
  recentApplications = [], 
  className,
  userId
}: AICoachTeaserProps) {
  // Don't show teaser to AI Coach users
  if (userPlan === "ai_coach") {
    return null;
  }

  // Track navigation view
  useEffect(() => {
    aiCoachAnalytics.trackNavigationViewed({
      subscription_plan: userPlan,
      user_id: userId,
    });
  }, [userPlan, userId]);

  // Handle upgrade click
  const handleUpgradeClick = () => {
    aiCoachAnalytics.trackUpgradeClick({
      source: 'navigation',
      subscription_plan: userPlan,
      user_id: userId,
    });
  };

  // Handle preview features click
  const handlePreviewClick = () => {
    aiCoachAnalytics.trackFeatureCardClick({
      feature_name: 'preview_features',
      location: 'navigation',
      subscription_plan: userPlan,
      user_id: userId,
    });
  };

  return (
    <Card className={`${AI_COACH_COLORS.border} ${AI_COACH_COLORS.gradientLight} ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${UI_CONSTANTS.SIZES.ICON.HERO} rounded-lg ${AI_COACH_COLORS.gradient} flex items-center justify-center`}>
              <Brain className={`${UI_CONSTANTS.SIZES.ICON.LG} text-white`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Unlock AI Career Coach
                <Badge className="bg-purple-600 text-white">PRO</Badge>
              </CardTitle>
              <CardDescription>
                Get personalized career insights powered by AI
              </CardDescription>
            </div>
          </div>
          <Sparkles className={`${UI_CONSTANTS.SIZES.ICON.XL} text-purple-600 animate-pulse`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
            <Brain className={`${UI_CONSTANTS.SIZES.ICON.MD} ${AI_COACH_COLORS.primary}`} />
            <div>
              <p className="font-medium text-sm">Resume Analysis</p>
              <p className="text-xs text-muted-foreground">AI-powered feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
            <MessageSquare className={`${UI_CONSTANTS.SIZES.ICON.MD} text-blue-600`} />
            <div>
              <p className="font-medium text-sm">Interview Prep</p>
              <p className="text-xs text-muted-foreground">Practice with AI</p>
            </div>
          </div>
        </div>
        
        {recentApplications.length > 0 && (
          <div className={`p-3 bg-white/70 rounded-lg ${AI_COACH_COLORS.border}`}>
            <p className="text-sm font-medium mb-2">Get AI insights for your recent applications:</p>
            <div className="space-y-1">
              {recentApplications.slice(0, APPLICATION_LIMITS.RECENT_DISPLAY).map((app) => (
                <div key={app.id} className="text-xs text-muted-foreground">
                  • {app.role} at {app.company}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button 
            className={`flex-1 ${AI_COACH_COLORS.primaryBg} ${AI_COACH_COLORS.primaryHover}`} 
            onClick={handleUpgradeClick}
            asChild
          >
            <Link href={NAVIGATION_URLS.UPGRADE}>
              <Crown className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`} />
              Upgrade Now
            </Link>
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePreviewClick}
            asChild
          >
            <Link href={NAVIGATION_URLS.AI_COACH}>
              Preview Features
              <ArrowRight className={`${UI_CONSTANTS.SIZES.ICON.SM} ml-2`} />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
