"use client";

import { useEffect, useMemo } from "react";
import { ApplicationCard } from "@/components/application-card";
import { useAnalyticsWithFallback } from "@/components/analytics-provider";
import type { Application, PermissionLevel } from "@/types";
import type { LocationContext } from "@/lib/types/analytics";

/**
 * Props for the ApplicationList component
 */
interface ApplicationListProps {
  /** Array of applications to display */
  applications: Application[];
  /** User's subscription plan for analytics */
  userPlan: PermissionLevel;
  /** User ID for analytics tracking */
  userId: string;
  /** Location context for analytics tracking */
  location?: LocationContext;
  /** Maximum number of applications to display */
  maxDisplay?: number;
}

/**
 * ApplicationList - Renders a list of application cards with analytics tracking
 *
 * Features:
 * - Performance optimized with memoization
 * - Analytics tracking for list views
 * - Configurable display limits
 * - Responsive design
 *
 * @param props - ApplicationListProps
 * @returns React functional component
 */
export function ApplicationList({
  applications,
  userPlan,
  userId,
  location = "dashboard",
  maxDisplay = 10,
}: ApplicationListProps) {
  // Get analytics service from context
  const analytics = useAnalyticsWithFallback();
  // Memoize displayed applications to prevent unnecessary recalculations
  const displayedApplications = useMemo(
    () => applications.slice(0, maxDisplay),
    [applications, maxDisplay]
  );

  // Memoize analytics params to prevent unnecessary effect triggers
  const analyticsParams = useMemo(
    () => ({
      total_applications: applications.length,
      displayed_applications: displayedApplications.length,
      has_filters_applied: false,
      view_type: location,
      subscription_plan: userPlan,
      user_id: userId,
    }),
    [
      applications.length,
      displayedApplications.length,
      location,
      userPlan,
      userId,
    ]
  );

  // Track list view analytics on mount and when key parameters change
  useEffect(() => {
    if (analytics) {
      analytics.trackListView(analyticsParams);
    }
  }, [analytics, analyticsParams]);

  return (
    <div className="space-y-4">
      {displayedApplications.map((app, index) => (
        <ApplicationCard
          key={app.id}
          application={app}
          index={index}
          location={location}
          userPlan={userPlan}
          userId={userId}
        />
      ))}

      {applications.length > maxDisplay && (
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {maxDisplay} of {applications.length} applications
          </p>
        </div>
      )}
    </div>
  );
}
