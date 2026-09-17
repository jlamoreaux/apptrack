/**
 * "How CareerOtter works" — the one help page (app/(marketing)/how-it-works).
 *
 * Inline copy answers questions where they come up: page intros, empty states,
 * the area hints, the coverage explainer. This page holds the questions that
 * span pages, in the same voice. Anything the product computes (the four
 * areas, the coverage target, the Free/Pro line) is pulled from its source so
 * the page cannot drift from the code.
 */

import { FAQS } from "@/lib/constants/homepage-content";
import { COVERAGE_TARGET_PER_AREA } from "@/lib/careerotter/coverage";
import { WIN_TAG_OPTIONS } from "@/lib/constants/careerotter";
import type { Faq } from "@/types";

export interface HelpSection {
  id: string;
  title: string;
  /** One or two sentences under the heading. */
  intro: string;
  /** Where to go to act on the section, if there is one place. */
  link?: { href: string; label: string };
  items: Faq[];
}

const AREA_LINES = WIN_TAG_OPTIONS.map((o) => `${o.label}: ${o.hint.toLowerCase()}.`).join(" ");

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: "the-loop",
    title: "The loop",
    intro:
      "Log what you ship as it happens. At review time, that log is what your case is built from.",
    link: { href: "/dashboard/wins", label: "Open your wins" },
    items: [
      {
        question: "What is a win?",
        answer:
          "One line about something you shipped, fixed, decided, or unblocked. Rough notes are fine. You are writing it for the version of you sitting in a review six months from now, who will not remember it.",
      },
      {
        question: "How often should I log?",
        answer:
          "When it happens, and at least weekly. A log that goes quiet for ten days is the failure mode that kills a case. Today's next move will tell you when it has gone quiet.",
      },
      {
        question: "What does the log turn into?",
        answer:
          "Review prep assembles it into a document: summary, evidence by area, impact, gaps, and the ask. The coach reasons from it. The weekly recap summarises it. None of that works on an empty log.",
      },
    ],
  },
  {
    id: "areas",
    title: "The four areas",
    intro:
      "Every win can carry one area. Areas are how the case shows breadth, which is what a promotion committee looks for.",
    items: [
      {
        question: "What are the areas?",
        answer: AREA_LINES,
      },
      {
        question: "Do I have to pick one?",
        answer:
          "No, but a win with no area counts toward nothing in coverage. You can set or change the area any time from the wins page.",
      },
      {
        question: "What if a win fits two areas?",
        answer:
          "Pick the one your case is thinnest on. Coverage names it, and the coach will point at it if you ask.",
      },
    ],
  },
  {
    id: "coverage",
    title: "Coverage",
    intro: "One number for how evenly your case is built, with no points and no streaks.",
    items: [
      {
        question: "How is coverage calculated?",
        answer: `Each of the four areas is fully evidenced at ${COVERAGE_TARGET_PER_AREA} wins and contributes an equal quarter of the total. Extra wins beyond ${COVERAGE_TARGET_PER_AREA} in one area do not raise the number, so stacking delivery wins cannot hide a gap in leadership. Wins with no area are not counted.`,
      },
      {
        question: "Why does it matter?",
        answer:
          "The gap is what someone will push on in the room. Coverage tells you where it is while there is still time to close it.",
      },
    ],
  },
  {
    id: "ai",
    title: "What the AI does, and does not",
    intro:
      "The coach, the starter case, and the case builder reason only from what you have logged plus your goal and review date.",
    items: [
      {
        question: "Will it make things up?",
        answer:
          "It is told not to, and its output is checked. Every percentage, dollar figure, and multiplier in a generated document is matched against what you typed. A number you never gave is removed and replaced with a prompt like [add the number], so you fill in the real figure instead of shipping an invented one.",
      },
      {
        question: "Why is the draft asking me for numbers?",
        answer:
          "Because you have not logged them. A win with a figure behind it is stronger evidence than one without. Add the number to the win, or into the draft where it asks.",
      },
      {
        question: "Is the document written in my voice?",
        answer:
          "Yes. The coach has a personality. The documents do not. They are first person, yours to edit, and meant to be handed to a manager as they are.",
      },
    ],
  },
  {
    id: "plans",
    title: "Free and Pro",
    intro: "Logging is free and always will be. The model calls are where Pro starts.",
    link: { href: "/dashboard/upgrade", label: "See plans" },
    items: FAQS.filter(
      (f) =>
        f.question.startsWith("What's the difference") ||
        f.question.startsWith("Do I need a credit card")
    ),
  },
  {
    id: "data",
    title: "Your data",
    intro: "You are logging real work. It stays yours.",
    link: { href: "/dashboard/data", label: "Open Your data" },
    items: [
      {
        question: "Who can see my wins?",
        answer:
          "You. We do not train models on your data, and nothing you log is shared with your employer or anyone else.",
      },
      {
        question: "Can I take it with me?",
        answer:
          "Yes. Export everything from the Your data page at any time. Delete your account and it is gone, wins included.",
      },
    ],
  },
];
