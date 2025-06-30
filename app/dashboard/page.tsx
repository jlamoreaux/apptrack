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
import { StatusBadge } from "@/components/status-badge";
import { AICoachDashboardIntegration } from "@/components/ai-coach-navigation";
import {
  NavigationErrorBoundary,
  AICoachFallback,
} from "@/components/NavigationErrorBoundary";
import { getPermissionLevelFromPlan } from "@/lib/constants/navigation";
import { APPLICATION_LIMITS } from "@/lib/constants/navigation";
import type { Application, ApplicationHistory } from "@/lib/types";

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
        <div className="container mx-auto py-8 space-y-8">
          {/* Header Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
            <p className="text-muted-foreground">
              Track your job application progress
            </p>
          </div>

          {/* Subscription Usage Banner */}
          <SubscriptionUsageBannerServer userId={user.id} />

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Applications
                </CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Applied</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.applied}</div>
              </CardContent>
            </Card>
            <Card className="border-secondary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Interviews
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.interviews}</div>
              </CardContent>
            </Card>
            <Card className="border-secondary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Offers</CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.offers}</div>
              </CardContent>
            </Card>
            <Card className="border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hired</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.hired}</div>
              </CardContent>
            </Card>
          </div>

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
          <ApplicationPipelineChart
            applications={applications}
            history={history}
          />

          {/* Applications List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-primary">
                    Recent Applications
                  </CardTitle>
                  <CardDescription>
                    Your latest job applications
                  </CardDescription>
                </div>
                <Link href="/dashboard/add">
                  <Button className="bg-secondary hover:bg-secondary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Application
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Building2 className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    No applications yet
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Start tracking your job search by adding your first
                    application. Keep all your opportunities organized in one
                    place.
                  </p>
                  <Link href="/dashboard/add">
                    <Button
                      size="lg"
                      className="bg-secondary hover:bg-secondary/90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Application
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.slice(0, 10).map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{app.role}</h3>
                          {app.role_link && (
                            <a
                              href={app.role_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground flex-shrink-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {app.company}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Applied:{" "}
                          {app.date_applied
                            ? new Date(app.date_applied).toLocaleDateString()
                            : "Not specified"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={app.status} />
                        <Link href={`/dashboard/application/${app.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}

                  {applications.length > 10 && (
                    <div className="text-center pt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing 10 of {applications.length} applications
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    // If there's an error fetching the user or applications, redirect to login
    redirect("/login?error=session_expired");
  }
}
