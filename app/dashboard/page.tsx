export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ApplicationPipelineChart } from "@/components/application-pipeline-chart";
import { NavigationServer } from "@/components/navigation-server";
import { SubscriptionUsageBannerServer } from "@/components/subscription-usage-banner-server";
import {
  getUser,
  getSubscription,
  getApplications,
  getApplicationHistory,
} from "@/lib/supabase/server";
import { AICoachDashboardIntegration } from "@/components/ai-coach-navigation";
import {
  NavigationErrorBoundary,
  AICoachFallback,
} from "@/components/NavigationErrorBoundary";
import { getPermissionLevelFromPlan } from "@/lib/constants/navigation";
import { APPLICATION_LIMITS } from "@/lib/constants/navigation";
import type { Application, ApplicationHistory } from "@/types";
import { DashboardApplicationsList } from "@/components/dashboard-applications-list";
import { DashboardSuccessToast } from "@/components/dashboard-success-toast";
import { Toaster } from "@/components/ui/toaster";
import { DashboardWithOnboarding } from "@/components/dashboard-with-onboarding";
import { DashboardStats } from "@/components/dashboard-stats";
import { HiredSubscriptionBanner } from "@/components/hired-subscription-banner";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";

export default async function DashboardPage() {
  // Add a timeout to prevent hanging
  const userPromise = getUser();
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("User fetch timeout")), 5000)
  );

  try {
    // Race the user fetch against a timeout
    const user = await Promise.race([userPromise, timeoutPromise]);

    if (!user) {
      redirect("/login");
    }

    // Once we have the user, get applications with a timeout as well
    const applicationsPromise = getApplications(user.id);
    const applicationsTimeoutPromise = new Promise<Application[]>((resolve) =>
      setTimeout(() => resolve([]), 5000)
    );

    // If applications fetch times out, we'll show an empty array rather than hanging
    const applications =
      (await Promise.race([applicationsPromise, applicationsTimeoutPromise])) ||
      [];

    // Get application history for all applications
    const historyPromise = getApplicationHistory(user.id);
    const historyTimeoutPromise = new Promise<ApplicationHistory[]>((resolve) =>
      setTimeout(() => resolve([]), 3000)
    );
    const history =
      (await Promise.race([historyPromise, historyTimeoutPromise])) || [];

    // Get subscription information for AI Coach integration
    const subscriptionPromise = getSubscription(user.id);
    const subscriptionTimeoutPromise = new Promise<any>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );
    const subscription =
      (await Promise.race([subscriptionPromise, subscriptionTimeoutPromise])) ||
      null;

    const planName = subscription?.subscription_plans?.name;
    const userPlan = getPermissionLevelFromPlan(planName);

    return (
      <DashboardWithOnboarding>
        <div className="min-h-screen bg-background">
          <NavigationServer />
          <DashboardSuccessToast />
          <Toaster />
          <main
            id="main-content"
            className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8"
          >
            {/* Header Section */}
            <header className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">
                Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Track your job application progress
              </p>
            </header>

            {/* Subscription Usage Banner */}
            <SubscriptionUsageBannerServer userId={user.id} />

            {/* Hired Subscription Cancellation Banner */}
            <HiredSubscriptionBanner
              hasHiredApplication={applications.some(
                (a) => a.status === "Hired"
              )}
              isPaidSubscriber={isOnProOrHigher(planName || "Free")}
            />

            {/* Stats Cards - Client-side for live data */}
            <DashboardStats userId={user.id} />

            {/* AI Coach Integration */}
            <NavigationErrorBoundary fallback={<AICoachFallback />}>
              <AICoachDashboardIntegration
                userPlan={userPlan}
                recentApplications={applications.slice(
                  0,
                  APPLICATION_LIMITS.DASHBOARD_DISPLAY
                )}
                userId={user.id}
              />
            </NavigationErrorBoundary>

            {/* Applications List */}
            <section aria-labelledby="applications-heading">
              <h2 id="applications-heading" className="sr-only">
                Recent Applications
              </h2>
              <DashboardApplicationsList
                userId={user.id}
                initialApplications={applications}
                initialTotal={applications.length}
              />
            </section>

            {/* Application Pipeline Chart */}
            <section aria-labelledby="chart-heading">
              <h2 id="chart-heading" className="sr-only">
                Application Pipeline Visualization
              </h2>
              <ApplicationPipelineChart
                applications={applications}
                history={history}
              />
            </section>
          </main>
        </div>
      </DashboardWithOnboarding>
    );
  } catch (error) {
    // If there's an error fetching the user or applications, redirect to login
    redirect("/login?error=session_expired");
  }
}
