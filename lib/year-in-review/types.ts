export const LABEL_IDS = [
  "connector",
  "craftsperson",
  "curator",
  "researcher",
  "explorer",
  "sprint",
  "long-game",
] as const;

export type LabelId = (typeof LABEL_IDS)[number];

export function isLabelId(value: unknown): value is LabelId {
  return typeof value === "string" && (LABEL_IDS as readonly string[]).includes(value);
}

/** The application columns the recap reads. */
export interface ReviewApplication {
  id: string;
  company: string;
  role: string;
  status: string;
  /** YYYY-MM-DD. Bucketed as a string so the result does not depend on timezone. */
  date_applied: string;
  archived?: boolean | null;
}

export interface ReviewHistoryRow {
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
}

/** Counts from the AI and networking tables, already limited to the year. */
export interface ReviewActivity {
  coverLetters: number;
  fitAnalyses: number;
  bestFitScore: number | null;
  interviewPreps: number;
  tailoredResumes: number;
  contactsAdded: number;
  contactsContacted: number;
  winsLogged: number;
}

export const EMPTY_ACTIVITY: ReviewActivity = {
  coverLetters: 0,
  fitAnalyses: 0,
  bestFitScore: null,
  interviewPreps: 0,
  tailoredResumes: 0,
  contactsAdded: 0,
  contactsContacted: 0,
  winsLogged: 0,
};

export interface ComputeInput {
  year: number;
  asOf: Date;
  applications: ReadonlyArray<ReviewApplication>;
  history: ReadonlyArray<ReviewHistoryRow>;
  activity: ReviewActivity;
}

export interface YearInReviewStats {
  year: number;
  /** YYYY-MM-DD the stats were computed for. */
  asOf: string;
  volume: {
    applications: number;
    companies: number;
    /** 0-11, or null with no applications. */
    busiestMonth: { month: number; count: number } | null;
    busiestWeek: { weekStart: string; count: number } | null;
    /** Applications per 7-day bucket counted from Jan 1 (53 buckets). */
    weekly: number[];
    activeMonths: number;
  };
  roles: {
    topRole: string | null;
    distinctRoles: number;
  };
  funnel: {
    applied: number;
    interviewed: number;
    offers: number;
    hired: number;
  };
  /** Null when fewer than MIN_RESPONSE_SAMPLES data points exist. */
  responseTime: { medianDays: number; sampleSize: number } | null;
  /** Private to the owner; never included in a share payload. */
  silence: { count: number };
  work: ReviewActivity;
  outcome: { company: string; role: string } | null;
  label: LabelId | null;
}
