import Image from "next/image";
import type { ReactNode } from "react";
import { LABELS, UNLABELED } from "@/lib/year-in-review/labels";
import { MONTH_NAMES, formatDayMonth, plural } from "@/lib/year-in-review/format";
import type { YearInReviewStats } from "@/lib/year-in-review/types";

export interface Slide {
  id: string;
  /** Background for the card; defaults to the neutral card surface. */
  tint?: string;
  ink?: string;
  content: ReactNode;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-base font-medium opacity-80 sm:text-lg">{children}</p>;
}

function BigNumber({ value, unit }: { value: string; unit: string }) {
  return (
    <p className="flex flex-col">
      <span className="text-6xl font-bold leading-none tracking-tight sm:text-7xl">{value}</span>
      <span className="mt-2 text-xl sm:text-2xl">{unit}</span>
    </p>
  );
}

function YearStrip({ weekly }: { weekly: number[] }) {
  const max = Math.max(1, ...weekly);
  return (
    <div className="flex h-32 items-end gap-[2px]" role="img" aria-label="Applications per week across the year">
      {weekly.map((count, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-current"
          // Height is data, so it cannot be a static Tailwind class.
          style={{ height: `${Math.max(count > 0 ? 8 : 2, (count / max) * 100)}%`, opacity: count > 0 ? 0.85 : 0.2 }}
        />
      ))}
    </div>
  );
}

function FunnelBars({ funnel }: { funnel: YearInReviewStats["funnel"] }) {
  const stages: Array<[string, number]> = [
    ["Applied", funnel.applied],
    ["Interviewed", funnel.interviewed],
    ["Offers", funnel.offers],
    ["Hired", funnel.hired],
  ];
  // A zero stage after Applied is left off rather than shown as an empty bar.
  const shown = stages.filter(([, count], i) => i === 0 || count > 0);
  return (
    <ol className="space-y-3">
      {shown.map(([name, count]) => (
        <li key={name} className="space-y-1">
          <div className="flex justify-between text-lg">
            <span>{name}</span>
            <span className="font-semibold">{count.toLocaleString("en-US")}</span>
          </div>
          <div className="relative h-4">
            <div className="absolute inset-0 rounded-full bg-current opacity-10" />
            <div
              className="relative h-4 rounded-full bg-current"
              style={{ width: `${Math.max(4, (count / Math.max(1, funnel.applied)) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function WorkGrid({ work }: { work: YearInReviewStats["work"] }) {
  const tiles: Array<[number, string, string]> = [
    [work.coverLetters, "cover letter", "cover letters"],
    [work.tailoredResumes, "tailored resume", "tailored resumes"],
    [work.fitAnalyses, "fit analysis", "fit analyses"],
    [work.interviewPreps, "interview prep", "interview preps"],
    [work.contactsContacted, "contact reached", "contacts reached"],
    [work.winsLogged, "win logged", "wins logged"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-6">
      {tiles
        .filter(([count]) => count > 0)
        .map(([count, one, many]) => (
          <div key={many}>
            <dt className="sr-only">{many}</dt>
            <dd className="text-4xl font-bold">{count.toLocaleString("en-US")}</dd>
            <dd className="text-lg">{count === 1 ? one : many}</dd>
          </div>
        ))}
    </dl>
  );
}

function hasWork(work: YearInReviewStats["work"]): boolean {
  return (
    work.coverLetters + work.tailoredResumes + work.fitAnalyses + work.interviewPreps + work.contactsContacted + work.winsLogged > 0
  );
}

/**
 * The closing line when the year did not end in a hire. Built from the user's
 * own numbers and worded so it also reads right for someone who was hired but
 * never logged it.
 */
export function stillInItLine(stats: YearInReviewStats): string {
  const { interviewed, applied } = stats.funnel;
  if (interviewed === 1) return "1 interview this year. That practice carries into the next one.";
  if (interviewed > 1) {
    return `${plural(interviewed, "interview", "interviews")} this year. Every one is practice the next one gets to use.`;
  }
  if (applied === 1) return "Your first application is logged. Next year builds on it.";
  return `${plural(applied, "application", "applications")} this year. Every one made the next one sharper.`;
}

/** The ordered cards for one recap. Cards with nothing to say are left out. */
export function buildSlides(stats: YearInReviewStats): Slide[] {
  const { volume, roles, funnel } = stats;
  const slides: Slide[] = [
    {
      id: "intro",
      content: (
        <div className="space-y-4">
          <Eyebrow>Your job search</Eyebrow>
          <h1 className="text-5xl font-bold leading-tight sm:text-6xl">{`${stats.year}, in review`}</h1>
          <p className="text-xl">Every application, interview and follow-up you logged, added up.</p>
        </div>
      ),
    },
    {
      id: "volume",
      content: (
        <div className="space-y-8">
          <Eyebrow>This year you sent</Eyebrow>
          <BigNumber value={volume.applications.toLocaleString("en-US")} unit={volume.applications === 1 ? "application" : "applications"} />
          <p className="text-xl">{`to ${plural(volume.companies, "company", "companies")}.`}</p>
          {volume.busiestMonth && (
            <p className="text-xl">
              {`${MONTH_NAMES[volume.busiestMonth.month]} was your busiest month, with ${plural(volume.busiestMonth.count, "application", "applications")}.`}
            </p>
          )}
        </div>
      ),
    },
  ];

  if (volume.applications >= 2 && volume.busiestWeek) {
    slides.push({
      id: "rhythm",
      content: (
        <div className="space-y-8">
          <Eyebrow>Your year, week by week</Eyebrow>
          <YearStrip weekly={volume.weekly} />
          <p className="text-xl">
            {`Your biggest week started ${formatDayMonth(volume.busiestWeek.weekStart)}: ${plural(volume.busiestWeek.count, "application", "applications")} in seven days.`}
          </p>
        </div>
      ),
    });
  }

  if (roles.topRole) {
    slides.push({
      id: "roles",
      content: (
        <div className="space-y-6">
          <Eyebrow>The role you went for most</Eyebrow>
          <p className="text-4xl font-bold leading-tight sm:text-5xl">{roles.topRole}</p>
          {roles.distinctRoles > 1 && (
            <p className="text-xl">{`Out of ${plural(roles.distinctRoles, "different role", "different roles")} in all.`}</p>
          )}
        </div>
      ),
    });
  }

  slides.push({
    id: "funnel",
    content: (
      <div className="space-y-8">
        <Eyebrow>Where they went</Eyebrow>
        <FunnelBars funnel={funnel} />
        {funnel.interviewed > 0 && (
          <p className="text-xl">{`${plural(funnel.interviewed, "application", "applications")} turned into interviews.`}</p>
        )}
      </div>
    ),
  });

  if (stats.responseTime) {
    slides.push({
      id: "response-time",
      content: (
        <div className="space-y-6">
          <Eyebrow>The typical wait to hear back</Eyebrow>
          <BigNumber value={stats.responseTime.medianDays.toLocaleString("en-US")} unit={stats.responseTime.medianDays === 1 ? "day" : "days"} />
          <p className="text-base opacity-80">
            {`Based on ${plural(stats.responseTime.sampleSize, "application", "applications")} with a recorded status change.`}
          </p>
        </div>
      ),
    });
  }

  if (stats.silence.count > 0) {
    slides.push({
      id: "silence",
      content: (
        <div className="space-y-6">
          <Eyebrow>Still waiting</Eyebrow>
          <BigNumber value={stats.silence.count.toLocaleString("en-US")} unit={stats.silence.count === 1 ? "application" : "applications"} />
          <p className="text-xl">
            {`${stats.silence.count === 1 ? "is" : "are"} still waiting on a reply after 30 days or more. That says more about hiring than it does about you.`}
          </p>
          <p className="text-base opacity-80">Only you can see this card. It is never included when you share.</p>
        </div>
      ),
    });
  }

  if (hasWork(stats.work)) {
    slides.push({
      id: "work",
      content: (
        <div className="space-y-8">
          <Eyebrow>The work behind it</Eyebrow>
          <WorkGrid work={stats.work} />
          {stats.work.bestFitScore !== null && (
            <p className="text-xl">{`Your best fit score was ${stats.work.bestFitScore}.`}</p>
          )}
        </div>
      ),
    });
  }

  if (stats.label) {
    const label = LABELS[stats.label];
    slides.push({
      id: "label",
      tint: label.tint,
      ink: label.ink,
      content: (
        <div className="grid items-center gap-6 sm:grid-cols-2">
          <Image
            src={label.image}
            alt={`An otter dressed as ${label.name}`}
            width={1728}
            height={2304}
            className="mx-auto h-auto max-h-[45vh] w-auto rounded-xl sm:max-h-[60vh]"
          />
          <div className="space-y-4">
            <Eyebrow>Your search style</Eyebrow>
            <h2 className="text-4xl font-bold sm:text-5xl">{label.name}</h2>
            <p className="text-xl">{label.description}</p>
          </div>
        </div>
      ),
    });
  }

  slides.push(
    stats.outcome
      ? {
          id: "outcome",
          content: (
            <div className="space-y-6">
              <Eyebrow>And then</Eyebrow>
              <h2 className="text-4xl font-bold leading-tight sm:text-5xl">{`You landed at ${stats.outcome.company}.`}</h2>
              <p className="text-xl">{stats.outcome.role}</p>
            </div>
          ),
        }
      : {
          id: "outcome",
          tint: UNLABELED.tint,
          ink: UNLABELED.ink,
          content: (
            <div className="grid items-center gap-6 sm:grid-cols-2">
              <Image
                src={UNLABELED.image}
                alt="The otter walking forward with a bag over one shoulder"
                width={1728}
                height={2304}
                className="mx-auto h-auto max-h-[45vh] w-auto rounded-xl sm:max-h-[60vh]"
              />
              <div className="space-y-4">
                <Eyebrow>Still in it</Eyebrow>
                <h2 className="text-4xl font-bold leading-tight">{stillInItLine(stats)}</h2>
              </div>
            </div>
          ),
        }
  );

  return slides;
}
