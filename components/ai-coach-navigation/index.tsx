"use client";

import { AICoachTeaser } from "./AICoachTeaser";
import { AICoachQuickActions } from "./AICoachQuickActions";
import type { Application, PermissionLevel } from "@/types";

interface AICoachDashboardIntegrationProps {
  userPlan: PermissionLevel;
  recentApplications?: Application[];
  className?: string;
  userId?: string;
}

/**
 * Main integration component that shows appropriate AI Coach content
 * based on user's subscription level
 */
export function AICoachDashboardIntegration({ 
  userPlan, 
  recentApplications = [], 
  className,
  userId
}: AICoachDashboardIntegrationProps) {
  // Show quick actions for AI Coach subscribers
  if (userPlan === "ai_coach") {
    return (
      <AICoachQuickActions 
        recentApplications={recentApplications} 
        className={className} 
        userId={userId}
      />
    );
  }

  // Show teaser for non-subscribers
  return (
    <AICoachTeaser 
      userPlan={userPlan}
      recentApplications={recentApplications} 
      className={className} 
      userId={userId}
    />
  );
}

// Re-export individual components for flexibility
export { AICoachTeaser } from "./AICoachTeaser";
export { AICoachQuickActions } from "./AICoachQuickActions";
