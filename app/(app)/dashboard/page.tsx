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
import { summarizeJobSearch } from "@/lib/careerotter/job-search-summary";
import { RECENT_HIRE_DAYS } from "@/lib/careerotter/next-move";

/** Applications Today needs: counts, plus the most recent hire. No descriptions. */
interface TodayApplication {
  status: string | null;
  company: string;
  role: string;
  updated_at: string | null;
}

/**
 * The most recent job marked Hired inside the recent-hire window, or null.
 * Drives Today's "set up your new role" move — the moment the product used to
 * treat as a cue to cancel.
 */
function findRecentHire(
  applications: TodayApplication[],
  now: Date
): { company: string; role: string } | null {
  const cutoff = now.getTime() - RECENT_HIRE_DAYS * 86_400_000;
  let best: { company: string; role: string; at: number } | null = null;

  for (const app of applications) {
    if (app.status !== "Hired" || !app.updated_at) continue;
    const at = new Date(app.updated_at).getTime();
    if (!Number.isFinite(at) || at < cutoff) continue;
    if (!best || at > best.at) best = { company: app.company, role: app.role, at };
  }

  return best ? { company: best.company, role: best.role } : null;
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

    // Everything Today renders, in one round trip. Applications go through the
    // session client (RLS); the career tables are service-role only, so they go
    // through the admin client scoped to this user's id.
    const dataPromise = Promise.all([
      supabase
        .from("applications")
        .select("status, company, role, updated_at")
        .eq("user_id", user.id)
        .eq("archived", false),
      admin
        .from("wins")
        .select("id, text, impact_number, tag, source, created_at, edited_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
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
    ]);

    // Degrade to an empty Today rather than hanging the page. The capture bar
    // and the first-win prompt still work, which is the point of the surface.
    const results = await Promise.race([
      dataPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    const apps = (results?.[0].data as TodayApplication[] | null) ?? [];
    const wins = results?.[1].data ?? null;
    const careerProfile = results?.[2].data ?? null;
    const recap = results?.[3].data ?? null;
    const compEntries = results?.[4].data ?? null;

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
              initialWins={(wins as LoggedWin[]) ?? []}
              recap={recap ?? null}
              hasCompEntry={(compEntries?.length ?? 0) > 0}
              recentHire={findRecentHire(apps, new Date())}
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
