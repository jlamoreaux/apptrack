import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { computeYearInReview } from "./compute";
import type { ReviewActivity, ReviewApplication, ReviewHistoryRow, YearInReviewStats } from "./types";

interface CountResult {
  count: number | null;
  error: unknown;
}

/**
 * Reads everything the recap needs for one user and year. Applications, history
 * and the RLS-covered AI tables go through the session client; tables that are
 * service-role only (or whose read policy hides rows) go through the admin
 * client, always with an explicit user_id predicate.
 */
export async function loadYearInReview(userId: string, year: number, now = new Date()): Promise<YearInReviewStats> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const createdFrom = `${year}-01-01T00:00:00Z`;
  const createdTo = `${year + 1}-01-01T00:00:00Z`;

  const [apps, history, coverLetters, fitAnalyses, interviewPreps, tailoredResumes, contacts, wins] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id, company, role, status, date_applied, archived")
        .eq("user_id", userId)
        .gte("date_applied", from)
        .lte("date_applied", to),
      supabase
        .from("application_history")
        .select("application_id, old_status, new_status, changed_at, applications!inner(user_id)")
        .eq("applications.user_id", userId)
        .gte("changed_at", createdFrom),
      supabase
        .from("cover_letters")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      // Admin client: the session read policy hides analyses not linked to an application.
      admin
        .from("job_fit_analysis")
        .select("fit_score")
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      supabase
        .from("interview_prep")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      admin
        .from("tailored_resumes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      supabase
        .from("application_linkedin_contacts")
        .select("contacted")
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      admin
        .from("wins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
    ]);

  const named: Array<[string, { error: unknown }]> = [
    ["applications", apps],
    ["application_history", history],
    ["cover_letters", coverLetters],
    ["job_fit_analysis", fitAnalyses],
    ["interview_prep", interviewPreps],
    ["tailored_resumes", tailoredResumes],
    ["application_linkedin_contacts", contacts],
    ["wins", wins],
  ];
  for (const [query, result] of named) {
    if (!result.error) continue;
    loggerService.error("Year in review query failed", result.error, {
      category: LogCategory.DATABASE,
      userId,
      action: "year_in_review_query_failed",
      metadata: { query, year },
    });
  }
  // Without applications there is no recap; surface that rather than render an empty year.
  if (apps.error) throw new Error("Failed to load applications for year in review");

  const fitRows = (fitAnalyses.data as Array<{ fit_score: number | null }> | null) ?? [];
  const fitScores = fitRows.map((r) => r.fit_score).filter((s): s is number => typeof s === "number");
  const contactRows = (contacts.data as Array<{ contacted: boolean | null }> | null) ?? [];
  const count = (r: CountResult) => r.count ?? 0;

  const activity: ReviewActivity = {
    coverLetters: count(coverLetters),
    fitAnalyses: fitRows.length,
    bestFitScore: fitScores.length ? Math.max(...fitScores) : null,
    interviewPreps: count(interviewPreps),
    tailoredResumes: count(tailoredResumes),
    contactsAdded: contactRows.length,
    contactsContacted: contactRows.filter((r) => r.contacted).length,
    winsLogged: count(wins),
  };

  return computeYearInReview({
    year,
    asOf: now,
    applications: (apps.data as ReviewApplication[] | null) ?? [],
    history: (history.data as ReviewHistoryRow[] | null) ?? [],
    activity,
  });
}
