import { APPLICATION_STATUS } from "@/lib/constants/application-status";
import { assignLabel } from "./labels";
import type {
  ComputeInput,
  ReviewApplication,
  ReviewHistoryRow,
  YearInReviewStats,
} from "./types";

const DAY_MS = 86_400_000;
export const WEEK_BUCKETS = 53;
export const MIN_RESPONSE_SAMPLES = 3;
export const SILENCE_DAYS = 30;
/** Two identical history rows closer than this are one change recorded twice. */
export const DUPLICATE_WINDOW_MS = 60_000;

const INTERVIEW_OR_LATER = new Set<string>([
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEWED,
  APPLICATION_STATUS.OFFER,
  APPLICATION_STATUS.HIRED,
]);
const OFFER_OR_LATER = new Set<string>([APPLICATION_STATUS.OFFER, APPLICATION_STATUS.HIRED]);

const SENIORITY_WORDS = new Set([
  "senior", "sr", "junior", "jr", "lead", "staff", "principal", "head", "i", "ii", "iii", "iv",
]);

/** Parses YYYY-MM-DD to a UTC day number, or null if malformed. */
function dayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : null;
}

function isoDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Role title reduced to what the job is, so "Senior Product Designer" and "Product Designer II" match. */
export function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !SENIORITY_WORDS.has(word))
    .join(" ");
}

/** Drops rows that repeat the previous transition for the same application within DUPLICATE_WINDOW_MS. */
export function dedupeHistory(rows: ReadonlyArray<ReviewHistoryRow>): ReviewHistoryRow[] {
  const sorted = [...rows]
    .filter((row) => Number.isFinite(Date.parse(row.changed_at)))
    .sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
  const lastByApp = new Map<string, ReviewHistoryRow>();
  const kept: ReviewHistoryRow[] = [];
  for (const row of sorted) {
    const prev = lastByApp.get(row.application_id);
    const duplicate =
      prev &&
      prev.new_status === row.new_status &&
      prev.old_status === row.old_status &&
      Date.parse(row.changed_at) - Date.parse(prev.changed_at) < DUPLICATE_WINDOW_MS;
    if (duplicate) continue;
    lastByApp.set(row.application_id, row);
    kept.push(row);
  }
  return kept;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Most frequent key; ties go to the alphabetically first so output is deterministic. */
function mostFrequent(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export function computeYearInReview(input: ComputeInput): YearInReviewStats {
  const { year, asOf, activity } = input;
  const yearStart = dayNumber(`${year}-01-01`)!;
  const yearEnd = dayNumber(`${year}-12-31`)!;
  const asOfDay = Math.floor(asOf.getTime() / DAY_MS);

  const apps: Array<ReviewApplication & { day: number }> = [];
  for (const app of input.applications) {
    const day = dayNumber(app.date_applied);
    if (day !== null && day >= yearStart && day <= yearEnd) apps.push({ ...app, day });
  }
  const appIds = new Set(apps.map((a) => a.id));
  const history = dedupeHistory(input.history.filter((h) => appIds.has(h.application_id)));
  const historyByApp = new Map<string, ReviewHistoryRow[]>();
  for (const row of history) {
    const list = historyByApp.get(row.application_id) ?? [];
    list.push(row);
    historyByApp.set(row.application_id, list);
  }

  // Volume
  const weekly = new Array<number>(WEEK_BUCKETS).fill(0);
  const monthly = new Array<number>(12).fill(0);
  const companies = new Set<string>();
  const roleCounts = new Map<string, number>();
  const roleSpellings = new Map<string, Map<string, number>>();
  for (const app of apps) {
    weekly[Math.min(WEEK_BUCKETS - 1, Math.floor((app.day - yearStart) / 7))]++;
    monthly[Number(app.date_applied.slice(5, 7)) - 1]++;
    const company = app.company.trim().toLowerCase();
    if (company) companies.add(company);
    const key = normalizeRole(app.role);
    if (key) {
      roleCounts.set(key, (roleCounts.get(key) ?? 0) + 1);
      const spellings = roleSpellings.get(key) ?? new Map<string, number>();
      const spelled = app.role.trim();
      spellings.set(spelled, (spellings.get(spelled) ?? 0) + 1);
      roleSpellings.set(key, spellings);
    }
  }

  let busiestMonth: YearInReviewStats["volume"]["busiestMonth"] = null;
  monthly.forEach((count, month) => {
    if (count > 0 && (!busiestMonth || count > busiestMonth.count)) busiestMonth = { month, count };
  });
  let busiestWeek: YearInReviewStats["volume"]["busiestWeek"] = null;
  weekly.forEach((count, week) => {
    // The last bucket holds only Dec 31 (Dec 30-31 in a leap year), not a full week.
    if (week === WEEK_BUCKETS - 1) return;
    if (count > 0 && (!busiestWeek || count > busiestWeek.count)) {
      busiestWeek = { weekStart: isoDate(yearStart + week * 7), count };
    }
  });

  const topKey = mostFrequent(roleCounts);
  const topRole = topKey ? mostFrequent(roleSpellings.get(topKey)!) : null;

  // Funnel, response time, silence, outcome
  let interviewed = 0;
  let offers = 0;
  let hired = 0;
  let silence = 0;
  const responseDays: number[] = [];
  let outcome: { company: string; role: string; at: number } | null = null;

  for (const app of apps) {
    const rows = historyByApp.get(app.id) ?? [];
    const reached = new Set<string>([app.status, ...rows.map((r) => r.new_status)]);
    if ([...reached].some((s) => INTERVIEW_OR_LATER.has(s))) interviewed++;
    if ([...reached].some((s) => OFFER_OR_LATER.has(s))) offers++;

    if (reached.has(APPLICATION_STATUS.HIRED)) {
      hired++;
      const hiredRow = [...rows].reverse().find((r) => r.new_status === APPLICATION_STATUS.HIRED);
      const at = hiredRow ? Date.parse(hiredRow.changed_at) : app.day * DAY_MS;
      if (!outcome || at > outcome.at) outcome = { company: app.company.trim(), role: app.role.trim(), at };
    }

    const firstChange = rows.find(
      (r) => r.new_status !== APPLICATION_STATUS.APPLIED && Date.parse(r.changed_at) >= app.day * DAY_MS
    );
    if (firstChange) {
      responseDays.push(Math.floor((Date.parse(firstChange.changed_at) - app.day * DAY_MS) / DAY_MS));
    }

    if (app.status === APPLICATION_STATUS.APPLIED && asOfDay - app.day >= SILENCE_DAYS) silence++;
  }

  const volume = {
    applications: apps.length,
    companies: companies.size,
    busiestMonth,
    busiestWeek,
    weekly,
    activeMonths: monthly.filter((n) => n > 0).length,
  };

  return {
    year,
    asOf: isoDate(asOfDay),
    volume,
    roles: { topRole, distinctRoles: roleCounts.size },
    funnel: { applied: apps.length, interviewed, offers, hired },
    responseTime:
      responseDays.length >= MIN_RESPONSE_SAMPLES
        ? { medianDays: median(responseDays), sampleSize: responseDays.length }
        : null,
    silence: { count: silence },
    work: activity,
    outcome: outcome ? { company: outcome.company, role: outcome.role } : null,
    label: assignLabel({
      applications: apps.length,
      interviewed,
      distinctRoles: roleCounts.size,
      weekly,
      work: activity,
    }),
  };
}
