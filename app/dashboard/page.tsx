export const dynamic = 'force-dynamic';
import { redirect } from "next/navigation";
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
  Plus,
  ExternalLink,
  Calendar,
  Building2,
  TrendingUp,
} from "lucide-react";
import { ApplicationPipelineChart } from "@/components/application-pipeline-chart";
import { NavigationServer } from "@/components/navigation-server";
import { SubscriptionUsageBannerServer } from "@/components/subscription-usage-banner-server";
import {
  getUser,
  getProfile,
  getSubscription,
  getUsage,
  getApplications,
  getApplicationHistory,
} from "@/lib/supabase/server";
import { ApplicationList } from "@/components/application-list";
import { AICoachDashboardIntegration } from "@/components/ai-coach-navigation";
import { AnalyticsProvider } from "@/components/analytics-provider";
import {
  NavigationErrorBoundary,
  AICoachFallback,
} from "@/components/NavigationErrorBoundary";
import { getPermissionLevelFromPlan } from "@/lib/constants/navigation";
import { APPLICATION_LIMITS } from "@/lib/constants/navigation";
import type { Application, ApplicationHistory } from "@/types";
import { DashboardApplicationsList } from "@/components/dashboard-applications-list";

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

    const stats = {
      total: applications.length,
      applied: applications.filter((app) => app.status === "Applied").length,
      interviews: applications.filter(
        (app) =>
          app.status === "Interview Scheduled" || app.status === "Interviewed"
      ).length,
      offers: applications.filter((app) => app.status === "Offer").length,
      hired: applications.filter((app) => app.status === "Hired").length,
    };

    return (
      <div className="min-h-screen bg-background">
        <NavigationServer />
        <main id="main-content" className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Header Section */}
          <header className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Track your job application progress
            </p>
          </header>

          {/* Subscription Usage Banner */}
          <SubscriptionUsageBannerServer userId={user.id} />

          {/* Stats Cards - Progressive responsive grid */}
          <section aria-labelledby="stats-heading" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
            <h2 id="stats-heading" className="sr-only">Application Statistics</h2>
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Total
                </CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Applied</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{stats.applied}</div>
              </CardContent>
            </Card>
            <Card className="border-secondary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Interviews
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{stats.interviews}</div>
              </CardContent>
            </Card>
            <Card className="border-secondary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Offers</CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{stats.offers}</div>
              </CardContent>
            </Card>
            <Card className="border-green-500/20 col-span-2 sm:col-span-1 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Hired</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{stats.hired}</div>
              </CardContent>
            </Card>
          </section>

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

          {/* Application Pipeline Chart */}
          <section aria-labelledby="chart-heading">
            <h2 id="chart-heading" className="sr-only">Application Pipeline Visualization</h2>
            <ApplicationPipelineChart
              applications={applications}
              history={history}
            />
          </section>

          {/* Applications List */}
          <section aria-labelledby="applications-heading">
            <h2 id="applications-heading" className="sr-only">Recent Applications</h2>
            <DashboardApplicationsList
              userId={user.id}
              initialApplications={applications}
              initialTotal={applications.length}
            />
          </section>
        </main>
      </div>
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    // If there's an error fetching the user or applications, redirect to login
    redirect("/login?error=session_expired");
  }
}
