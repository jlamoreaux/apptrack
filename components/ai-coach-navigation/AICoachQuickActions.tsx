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
import {
  Brain,
  Zap,
  MessageSquare,
  Target,
} from "lucide-react";
import { 
  AI_COACH_COLORS,
  APPLICATION_LIMITS,
  QUICK_ACTIONS 
} from "@/lib/constants/navigation";
import { UI_CONSTANTS } from "@/lib/constants/ui";
import { APP_ROUTES } from "@/lib/constants/routes";
import { aiCoachAnalytics } from "@/lib/analytics";
import type { Application } from "@/types";

// Icon mapping for string-based icon names
const ICON_MAP = {
  Brain,
  MessageSquare,
  Target,
} as const;

interface AICoachQuickActionsProps {
  recentApplications: Application[];
  className?: string;
  userId?: string;
}

/**
 * Quick actions component for AI Coach subscribers
 * Shows actionable AI features and recent application integration
 */
export function AICoachQuickActions({ 
  recentApplications, 
  className,
  userId
}: AICoachQuickActionsProps) {
  // Track navigation view for AI Coach users
  useEffect(() => {
    aiCoachAnalytics.trackNavigationViewed({
      subscription_plan: 'ai_coach',
      user_id: userId,
    });
  }, [userId]);

  // Handle quick action clicks
  const handleQuickActionClick = (featureName: string) => {
    aiCoachAnalytics.trackFeatureCardClick({
      feature_name: featureName,
      location: 'navigation',
      subscription_plan: 'ai_coach',
      user_id: userId,
    });
  };

  // Handle application-specific action clicks
  const handleApplicationActionClick = (featureName: string, applicationId: string) => {
    aiCoachAnalytics.trackFeatureCardClick({
      feature_name: featureName,
      location: 'navigation',
      subscription_plan: 'ai_coach',
      user_id: userId,
    });
  };
  return (
    <Card className={`${AI_COACH_COLORS.border} ${className}`} data-onboarding="ai-coach-nav">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className={`${UI_CONSTANTS.SIZES.ICON.MD} ${AI_COACH_COLORS.primary}`} />
          AI Coach Quick Actions
          <Zap className={`${UI_CONSTANTS.SIZES.ICON.SM} text-yellow-500`} />
        </CardTitle>
        <CardDescription>
          Get instant AI insights for your job search
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = ICON_MAP[action.icon as keyof typeof ICON_MAP];
            const colorClass = action.color === 'purple' 
              ? AI_COACH_COLORS.primary
              : action.color === 'blue'
              ? 'text-blue-600'
              : 'text-green-600';
            
            return (
              <Button 
                key={action.id}
                variant="outline" 
                size="sm" 
                className="h-auto p-3" 
                onClick={() => handleQuickActionClick(action.label.toLowerCase().replace(' ', '_'))}
                asChild
              >
                <Link href={action.href}>
                  <div className="text-center space-y-1">
                    <Icon className={`${UI_CONSTANTS.SIZES.ICON.MD} mx-auto ${colorClass}`} />
                    <p className="text-xs font-medium">{action.label}</p>
                  </div>
                </Link>
              </Button>
            );
          })}
        </div>

        {recentApplications.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick actions for recent applications:</p>
            {recentApplications.slice(0, APPLICATION_LIMITS.RECENT_DISPLAY).map((app) => (
              <div key={app.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{app.role}</p>
                  <p className="text-xs text-muted-foreground truncate">{app.company}</p>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleApplicationActionClick('interview_prep', app.id)}
                    asChild
                  >
                    <Link href={APP_ROUTES.DYNAMIC.aiCoachWithApplication(app.id, "interview")}>
                      <MessageSquare className={UI_CONSTANTS.SIZES.ICON.XS} />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
