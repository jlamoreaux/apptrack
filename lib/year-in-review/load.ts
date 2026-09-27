import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { computeYearInReview } from "./compute";
import type { ReviewActivity, ReviewApplication, ReviewHistoryRow, YearInReviewStats } from "./types";

/** PostgREST caps a response at 1000 rows without erroring, so row reads page. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

interface Page<T> {
  data: T[] | null;
  error: unknown;
}

/** Reads every page of a query. `build` must return a fresh query for each range. */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<Page<T>>
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await build(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
  // Every page came back full, so rows remain unread: a partial read is an error,
  // not a smaller year.
  return { data: rows, error: new Error(`Row limit reached (${MAX_PAGES * PAGE_SIZE})`) };
}

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

  const [apps, history, coverLetters, fitCount, bestFit, interviewPreps, tailoredResumes, contactsAdded, contactsContacted, wins] =
    await Promise.all([
      fetchAllRows<ReviewApplication>((a, b) =>
        supabase
          .from("applications")
          .select("id, company, role, status, date_applied, archived")
          .eq("user_id", userId)
          .gte("date_applied", from)
          .lte("date_applied", to)
          .order("id")
          .range(a, b)
      ),
      // Only history for this year's applications, whenever the change happened.
      fetchAllRows<ReviewHistoryRow>((a, b) =>
        supabase
          .from("application_history")
          .select("application_id, old_status, new_status, changed_at, applications!inner(user_id, date_applied)")
          .eq("applications.user_id", userId)
          .gte("applications.date_applied", from)
          .lte("applications.date_applied", to)
          .order("id")
          .range(a, b)
      ),
      supabase
        .from("cover_letters")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      // Admin client: the session read policy hides analyses not linked to an application.
      admin
        .from("job_fit_analysis")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      admin
        .from("job_fit_analysis")
        .select("fit_score")
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo)
        .not("fit_score", "is", null)
        .order("fit_score", { ascending: false })
        .limit(1),
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
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", createdFrom)
        .lt("created_at", createdTo),
      supabase
        .from("application_linkedin_contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("contacted", true)
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
    ["job_fit_analysis_count", fitCount],
    ["job_fit_analysis_best", bestFit],
    ["interview_prep", interviewPreps],
    ["tailored_resumes", tailoredResumes],
    ["linkedin_contacts_added", contactsAdded],
    ["linkedin_contacts_contacted", contactsContacted],
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
  // Any failed read would turn into a zero here, and a share link would then sign
  // that wrong number permanently. Fail the whole load instead.
  if (named.some(([, result]) => result.error)) throw new Error("Failed to load year in review");

  const best = (bestFit.data as Array<{ fit_score: number | null }> | null)?.[0]?.fit_score;
  const count = (r: CountResult) => r.count ?? 0;

  const activity: ReviewActivity = {
    coverLetters: count(coverLetters),
    fitAnalyses: count(fitCount),
    bestFitScore: typeof best === "number" ? best : null,
    interviewPreps: count(interviewPreps),
    tailoredResumes: count(tailoredResumes),
    contactsAdded: count(contactsAdded),
    contactsContacted: count(contactsContacted),
    winsLogged: count(wins),
  };

  return computeYearInReview({
    year,
    asOf: now,
    applications: apps.data,
    history: history.data,
    activity,
  });
}
