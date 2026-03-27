export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { SubscriptionUsageBannerServer } from "@/components/subscription-usage-banner-server";
import {
  getUser,
  getSubscription,
  getApplications,
  getApplicationHistory,
} from "@/lib/supabase/server";
import { getPermissionLevelFromPlan } from "@/lib/constants/navigation";
import type { Application, ApplicationHistory } from "@/types";
import { DashboardSuccessToast } from "@/components/dashboard-success-toast";
import { Toaster } from "@/components/ui/toaster";
import { DashboardWithOnboarding } from "@/components/dashboard-with-onboarding";
import { HiredSubscriptionBanner } from "@/components/hired-subscription-banner";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";
import { DashboardLayoutWrapper } from "@/components/dashboard-layout-wrapper";
import { getServerFeatureFlag } from "@/lib/analytics/posthog-server";

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

    // Evaluate feature flag server-side to avoid flash of content
    let isAuditEnabled = false;
    try {
      isAuditEnabled = await Promise.race([
        getServerFeatureFlag(user.id, "dashboard-ux-audit-v1"),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);
    } catch {
      // Flag fetch failed — fall back to disabled
    }

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
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
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
              userId={user.id}
            />

            <DashboardLayoutWrapper
              userId={user.id}
              userPlan={userPlan}
              applications={applications}
              history={history}
              serverFlagEnabled={isAuditEnabled}
            />
          </main>
        </div>
      </DashboardWithOnboarding>
    );
  } catch (error) {
    // If there's an error fetching the user or applications, redirect to login
    redirect("/login?error=session_expired");
  }
}
