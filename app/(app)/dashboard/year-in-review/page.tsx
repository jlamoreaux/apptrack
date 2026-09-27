export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { Button } from "@/components/ui/button";
import { YearInReviewStory } from "@/components/year-in-review/year-in-review-story";
import { getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { isYearInReviewEnabled } from "@/lib/year-in-review/gate";
import { loadYearInReview } from "@/lib/year-in-review/load";
import { defaultReviewYear, isReviewableYear } from "@/lib/year-in-review/years";
import type { YearInReviewStats } from "@/lib/year-in-review/types";

export default async function YearInReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  if (!isYearInReviewEnabled()) notFound();

  const user = await getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : defaultReviewYear(now);
  if (!isReviewableYear(year, now)) notFound();

  let stats: YearInReviewStats | null = null;
  try {
    stats = await loadYearInReview(user.id, year, now);
  } catch (error) {
    loggerService.error("Failed to load year in review", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "year_in_review_load_failed",
      metadata: { year },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main id="main-content">
        {stats && stats.volume.applications > 0 ? (
          <YearInReviewStory stats={stats} />
        ) : (
          <div className="container mx-auto max-w-3xl space-y-4 px-4 py-16">
            <h1 className="text-3xl font-bold">{`Your ${year} in review`}</h1>
            <p className="text-lg text-muted-foreground">
              {stats
                ? `There are no applications dated ${year} yet. Log the ones you sent and your recap fills in.`
                : "Your recap could not be loaded right now. Try again in a moment."}
            </p>
            <Button asChild size="lg">
              <Link href={stats ? "/dashboard/add" : "/dashboard"}>{stats ? "Add an application" : "Back to Today"}</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
