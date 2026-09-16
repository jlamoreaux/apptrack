export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { SubscriptionUsageBannerServer } from "@/components/subscription-usage-banner-server";
import { getUser, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { DashboardSuccessToast } from "@/components/dashboard-success-toast";
import { Toaster } from "@/components/ui/toaster";
import { DashboardWithOnboarding } from "@/components/dashboard-with-onboarding";
import { TodayOverview } from "@/components/careerotter/today-overview";
import type { LoggedWin } from "@/components/careerotter/win-capture-bar";
import type { WinSummary } from "@/lib/careerotter/next-move";
import { RECENT_WINS_SHOWN } from "@/lib/constants/careerotter";
import { summarizeJobSearch } from "@/lib/careerotter/job-search-summary";
import { findRecentHire, type HireTransition } from "@/lib/careerotter/recent-hire";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/** Applications Today needs: statuses for the strip's counts. Nothing else. */
interface TodayApplication {
  status: string | null;
}

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

    const supabase = await createClient();
    const admin = createAdminClient();

    // Everything Today renders, in one round trip. Applications and their
    // history go through the session client (RLS); the career tables are
    // service-role only, so they go through the admin client scoped to this
    // user's id.
    //
    // Wins are fetched twice on purpose. The coverage meter, the staleness
    // check and the week count need every row, but only need (tag, created_at);
    // the "Recently" list needs full text for five. Sending the whole log with
    // its 2000-char bodies would put megabytes of RSC payload on the wire for
    // exactly the users who log the most.
    const dataPromise = Promise.all([
      supabase
        .from("applications")
        .select("status")
        .eq("user_id", user.id)
        .eq("archived", false),
      admin
        .from("wins")
        .select("tag, created_at")
        .eq("user_id", user.id),
      admin
        .from("wins")
        .select("id, text, impact_number, tag, source, created_at, edited_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(RECENT_WINS_SHOWN),
      admin
        .from("career_profiles")
        .select("mode, role, level, target, review_date, zero_to_case_completed_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("weekly_recaps")
        .select("week_start, generated_text, wins_included")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Existence check only: the comp page owns the numbers.
      admin.from("comp_entries").select("id").eq("user_id", user.id).limit(1),
      supabase
        .from("application_history")
        .select("changed_at, applications!inner(user_id, company, role, archived)")
        .eq("applications.user_id", user.id)
        .eq("new_status", "Hired")
        .order("changed_at", { ascending: false })
        .limit(5),
    ]);

    // Degrade to an empty Today rather than hanging the page. The capture bar
    // and the first-win prompt still work, which is the point of the surface.
    const results = await Promise.race([
      dataPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (!results) {
      loggerService.warn("Today data fetch timed out", {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "today_fetch_timeout",
      });
    }

    // A silently failed read renders an established user as a brand-new one, so
    // say so in the logs rather than only on their screen.
    const queryNames = [
      "applications",
      "win_summaries",
      "recent_wins",
      "career_profile",
      "weekly_recap",
      "comp_entries",
      "hire_history",
    ];
    results?.forEach((result, i) => {
      if (!result.error) return;
      loggerService.error("Today data query failed", result.error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "today_query_failed",
        metadata: { query: queryNames[i] },
      });
    });

    const apps = (results?.[0].data as TodayApplication[] | null) ?? [];
    const winSummaries = (results?.[1].data as WinSummary[] | null) ?? [];
    const recentWins = (results?.[2].data as LoggedWin[] | null) ?? [];
    const careerProfile = results?.[3].data ?? null;
    const recap = results?.[4].data ?? null;
    const compEntries = results?.[5].data ?? null;
    const hires = (results?.[6].data as HireTransition[] | null) ?? [];

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
            <SubscriptionUsageBannerServer userId={user.id} />

            <TodayOverview
              goal={{
                mode: careerProfile?.mode ?? null,
                role: careerProfile?.role ?? null,
                level: careerProfile?.level ?? null,
                target: careerProfile?.target ?? null,
                review_date: careerProfile?.review_date ?? null,
              }}
              zeroToCaseCompleted={Boolean(careerProfile?.zero_to_case_completed_at)}
              initialWinSummaries={winSummaries}
              initialRecentWins={recentWins}
              recap={recap ?? null}
              hasCompEntry={(compEntries?.length ?? 0) > 0}
              recentHire={findRecentHire(hires, new Date())}
              jobSearch={summarizeJobSearch(apps)}
            />
          </main>
        </div>
      </DashboardWithOnboarding>
    );
  } catch (error) {
    redirect("/login?error=session_expired");
  }
}
