import Image from "next/image";
import Link from "next/link";
import { isYearInReviewEnabled } from "@/lib/year-in-review/gate";
import { defaultReviewYear } from "@/lib/year-in-review/years";

/** December and January only: the recap is a year-end moment, not a permanent fixture. */
export function isYearInReviewSeason(now: Date): boolean {
  const month = now.getUTCMonth();
  return month === 11 || month === 0;
}

export function YearInReviewEntry({ now = new Date() }: { now?: Date }) {
  if (!isYearInReviewEnabled() || !isYearInReviewSeason(now)) return null;
  const year = defaultReviewYear(now);

  return (
    <Link
      href="/dashboard/year-in-review"
      className="flex min-h-11 items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Image
        src="/images/year-in-review/reference/otter-head.jpg"
        alt=""
        width={64}
        height={64}
        className="h-16 w-16 rounded-lg object-cover"
      />
      <span className="space-y-1">
        <span className="block text-lg font-semibold">{`Your ${year} in review is ready`}</span>
        <span className="block text-sm text-muted-foreground">
          Your applications, interviews and the work behind them, added up.
        </span>
      </span>
    </Link>
  );
}
