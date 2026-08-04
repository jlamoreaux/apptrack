export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { SubscriptionUsageBannerServer } from "@/components/subscription-usage-banner-server";
import { getUser, getSubscription, getApplications } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import type { Application } from "@/types";
import { DashboardSuccessToast } from "@/components/dashboard-success-toast";
import { Toaster } from "@/components/ui/toaster";
import { DashboardWithOnboarding } from "@/components/dashboard-with-onboarding";
import { HiredSubscriptionBanner } from "@/components/hired-subscription-banner";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";
import { TodayOverview } from "@/components/careerotter/today-overview";

export default async function DashboardPage() {
  // Add a timeout to prevent hanging
  const userPromise = getUser();
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("User fetch timeout")), 5000)
  );

  try {
    const user = await Promise.race([userPromise, timeoutPromise]);
    if (!user) {
      redirect("/login");
    }

    // Applications still power the job-search summary strip + the hired banner.
    const applicationsPromise = getApplications(user.id);
    const applicationsTimeoutPromise = new Promise<Application[]>((resolve) =>
      setTimeout(() => resolve([]), 5000)
    );
    const applications =
      (await Promise.race([applicationsPromise, applicationsTimeoutPromise])) ||
      [];

    // Career data for the Today surface (coverage + review countdown).
    const admin = createAdminClient();
    const [{ data: wins }, { data: careerProfile }] = await Promise.all([
      admin.from("wins").select("tag").eq("user_id", user.id),
      admin
        .from("career_profiles")
        .select("review_date")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    // Subscription drives the hired/career banners only.
    const subscriptionPromise = getSubscription(user.id);
    const subscriptionTimeoutPromise = new Promise<any>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );
    const subscription =
      (await Promise.race([subscriptionPromise, subscriptionTimeoutPromise])) ||
      null;
    const planName = subscription?.subscription_plans?.name;

    return (
      <DashboardWithOnboarding>
        <div className="min-h-screen bg-background">
          <NavigationServer />
          <DashboardSuccessToast />
          <Toaster />
          <main
            id="main-content"
            className="container mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8"
          >
            <header className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Today
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Your review countdown, case coverage, and what to do next.
              </p>
            </header>

            <SubscriptionUsageBannerServer userId={user.id} />

            {(() => {
              const hasHiredApplication = applications.some(
                (a) => a.status === "Hired"
              );
              const isPaidSubscriber = isOnProOrHigher(planName || "Free");
              return (
                <HiredSubscriptionBanner
                  hasHiredApplication={hasHiredApplication}
                  isPaidSubscriber={isPaidSubscriber}
                  userId={user.id}
                />
              );
            })()}

            <TodayOverview
              wins={wins ?? []}
              reviewDate={careerProfile?.review_date ?? null}
              applications={applications}
            />
          </main>
        </div>
      </DashboardWithOnboarding>
    );
  } catch (error) {
    redirect("/login?error=session_expired");
  }
}
