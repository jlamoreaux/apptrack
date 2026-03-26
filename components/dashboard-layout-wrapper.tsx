"use client";

import { AICoachDashboardIntegration } from "@/components/ai-coach-navigation";
import {
  NavigationErrorBoundary,
  AICoachFallback,
} from "@/components/NavigationErrorBoundary";
import { DashboardApplicationsList } from "@/components/dashboard-applications-list";
import { DashboardStats } from "@/components/dashboard-stats";
import { ApplicationPipelineChart } from "@/components/application-pipeline-chart";
import { APPLICATION_LIMITS } from "@/lib/constants/navigation";
import { DashboardFlagsProvider } from "@/components/providers/dashboard-flags-provider";
import type { Application, ApplicationHistory, PermissionLevel } from "@/types";

interface DashboardLayoutWrapperProps {
  userId: string;
  userPlan: PermissionLevel;
  applications: Application[];
  history: ApplicationHistory[];
  /** Evaluated server-side to avoid flash of content */
  serverFlagEnabled: boolean;
}

export function DashboardLayoutWrapper({
  userId,
  userPlan,
  applications,
  history,
  serverFlagEnabled,
}: DashboardLayoutWrapperProps) {
  const recentApplications = applications.slice(
    0,
    APPLICATION_LIMITS.DASHBOARD_DISPLAY
  );

  const flags = { isAuditEnabled: serverFlagEnabled };

  if (serverFlagEnabled) {
    // New layout: Stats > Apps > Pipeline > AI Coach (compact, at bottom)
    return (
      <DashboardFlagsProvider flags={flags}>
        <DashboardStats userId={userId} />

        <section aria-labelledby="applications-heading">
          <h2 id="applications-heading" className="sr-only">
            Recent Applications
          </h2>
          <DashboardApplicationsList
            userId={userId}
            initialApplications={applications}
            initialTotal={applications.length}
          />
        </section>

        <section aria-labelledby="chart-heading">
          <h2 id="chart-heading" className="sr-only">
            Application Pipeline Visualization
          </h2>
          <ApplicationPipelineChart
            applications={applications}
            history={history}
          />
        </section>

        <NavigationErrorBoundary fallback={<AICoachFallback />}>
          <AICoachDashboardIntegration
            userPlan={userPlan}
            recentApplications={recentApplications}
            userId={userId}
            compact
          />
        </NavigationErrorBoundary>
      </DashboardFlagsProvider>
    );
  }

  // Original layout: Stats > AI Coach > Apps > Pipeline
  return (
    <DashboardFlagsProvider flags={flags}>
      <DashboardStats userId={userId} />

      <NavigationErrorBoundary fallback={<AICoachFallback />}>
        <AICoachDashboardIntegration
          userPlan={userPlan}
          recentApplications={recentApplications}
          userId={userId}
        />
      </NavigationErrorBoundary>

      <section aria-labelledby="applications-heading">
        <h2 id="applications-heading" className="sr-only">
          Recent Applications
        </h2>
        <DashboardApplicationsList
          userId={userId}
          initialApplications={applications}
          initialTotal={applications.length}
        />
      </section>

      <section aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="sr-only">
          Application Pipeline Visualization
        </h2>
        <ApplicationPipelineChart
          applications={applications}
          history={history}
        />
      </section>
    </DashboardFlagsProvider>
  );
}
