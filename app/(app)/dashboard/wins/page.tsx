export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { WinsBoard } from "@/components/careerotter/wins-board";
import type { LoggedWin } from "@/components/careerotter/win-capture-bar";

/**
 * The "Today" evidence surface (CareerOtter M2): review countdown, case
 * coverage, capture bar, and the wins log. Server-fetches the initial data with
 * the service-role client scoped to the session user, then hands it to the
 * client board for instant updates.
 */
export default async function WinsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: wins }, { data: profile }] = await Promise.all([
    admin
      .from("wins")
      .select("id, text, impact_number, tag, source, created_at, edited_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("career_profiles")
      .select("review_date, mode, target")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold">Your wins</h1>
          <p className="text-sm text-muted-foreground">
            Log what you ship as it happens. It becomes your case at review time.
          </p>
        </div>
        <WinsBoard
          initialWins={(wins as LoggedWin[]) ?? []}
          reviewDate={profile?.review_date ?? null}
        />
      </main>
    </div>
  );
}
