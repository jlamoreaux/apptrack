import type { LabelId, ReviewActivity } from "./types";

/**
 * Starting points, not tuned values. Adjust against real distributions so that
 * no single label covers much more than ~40% of labeled users.
 */
export const LABEL_THRESHOLDS = {
  minApplications: 5,
  connectorContacted: 5,
  craftRatio: 0.5,
  curatorMaxApplications: 15,
  curatorInterviewRate: 0.3,
  researcherRatio: 0.5,
  explorerMinRoles: 4,
  explorerRoleRatio: 0.3,
  sprintWindowWeeks: 8,
  sprintShare: 0.5,
} as const;

export interface LabelDefinition {
  name: string;
  description: string;
  image: string;
  /** Card background. Paired with `ink` text, both pass WCAG AA. */
  tint: string;
  ink: string;
}

const INK = "#1F1A14";

export const LABELS: Record<LabelId, LabelDefinition> = {
  connector: {
    name: "The Connector",
    description: "You treated the search as a conversation, reaching out to people and not just postings.",
    image: "/images/year-in-review/the-connector.jpg",
    tint: "#DCE4F2",
    ink: INK,
  },
  craftsperson: {
    name: "The Craftsperson",
    description: "You tailored the work to each role. Fewer templates, more fit.",
    image: "/images/year-in-review/the-craftsperson.jpg",
    tint: "#F2DCDF",
    ink: INK,
  },
  curator: {
    name: "The Curator",
    description: "You chose carefully, and it showed in how often you got the interview.",
    image: "/images/year-in-review/the-curator.jpg",
    tint: "#F6E7B8",
    ink: INK,
  },
  researcher: {
    name: "The Researcher",
    description: "You did the homework before you hit apply.",
    image: "/images/year-in-review/the-researcher.jpg",
    tint: "#DDEBDD",
    ink: INK,
  },
  explorer: {
    name: "The Explorer",
    description: "You kept your options wide and tried on different roles.",
    image: "/images/year-in-review/the-explorer.jpg",
    tint: "#E8E4CC",
    ink: INK,
  },
  sprint: {
    name: "The Sprint",
    description: "You went all in. Most of your search happened in one concentrated stretch.",
    image: "/images/year-in-review/the-sprint.jpg",
    tint: "#CDEFE9",
    ink: INK,
  },
  "long-game": {
    name: "The Long Game",
    description: "You kept showing up, month after month.",
    image: "/images/year-in-review/the-long-game.jpg",
    tint: "#D6ECF5",
    ink: INK,
  },
};

/**
 * Shown in place of a label when there is too little data to assign one, and on
 * the closing card when the year did not end in a hire.
 */
export const UNLABELED = {
  image: "/images/year-in-review/still-in-it.jpg",
  tint: "#EDE8E1",
  ink: INK,
} as const;

export interface LabelInput {
  applications: number;
  interviewed: number;
  distinctRoles: number;
  weekly: ReadonlyArray<number>;
  work: ReviewActivity;
}

/** Largest share of applications that fall inside any window of `weeks` consecutive weeks. */
export function peakWindowShare(weekly: ReadonlyArray<number>, weeks: number): number {
  const total = weekly.reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;
  let best = 0;
  let running = 0;
  for (let i = 0; i < weekly.length; i++) {
    running += weekly[i];
    if (i >= weeks) running -= weekly[i - weeks];
    best = Math.max(best, running);
  }
  return best / total;
}

/**
 * Behaviour rules first, in order, then timing. Timing always resolves, so
 * every user at or above the minimum gets a label.
 */
export function assignLabel(input: LabelInput): LabelId | null {
  const t = LABEL_THRESHOLDS;
  const n = input.applications;
  if (n < t.minApplications) return null;

  if (input.work.contactsContacted >= t.connectorContacted) return "connector";
  if ((input.work.coverLetters + input.work.tailoredResumes) / n >= t.craftRatio) return "craftsperson";
  if (n <= t.curatorMaxApplications && input.interviewed / n >= t.curatorInterviewRate) return "curator";
  if (input.work.fitAnalyses / n >= t.researcherRatio) return "researcher";
  if (input.distinctRoles >= t.explorerMinRoles && input.distinctRoles / n >= t.explorerRoleRatio) {
    return "explorer";
  }
  return peakWindowShare(input.weekly, t.sprintWindowWeeks) >= t.sprintShare ? "sprint" : "long-game";
}
