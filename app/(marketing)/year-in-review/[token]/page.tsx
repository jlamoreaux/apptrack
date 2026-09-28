import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavigationStatic } from "@/components/navigation-static";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/year-in-review/format";
import { LABELS, UNLABELED } from "@/lib/year-in-review/labels";
import { resolveSharePayload } from "@/lib/year-in-review/share-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const payload = resolveSharePayload(token);
  if (!payload) return { robots: { index: false, follow: false } };

  const labelName = payload.l ? LABELS[payload.l].name : null;
  const title = labelName
    ? `${labelName}: a ${payload.y} job search`
    : `A ${payload.y} job search, in review`;
  const description = `${payload.a} applications to ${payload.c} companies. Made with CareerOtter.`;
  return {
    title,
    description,
    // Personal pages: shareable by link, never indexed.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "CareerOtter" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function YearInReviewSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = resolveSharePayload(token);
  if (!payload) notFound();

  const label = payload.l ? LABELS[payload.l] : null;
  const stats: Array<[number, string, string]> = [
    [payload.a, "application", "applications"],
    [payload.c, "company", "companies"],
    [payload.i, "interview", "interviews"],
    [payload.o, "offer", "offers"],
  ];

  return (
    <>
      <NavigationStatic />
      <main className="container mx-auto max-w-6xl px-4 py-16">
        <div
          className="mx-auto grid max-w-4xl items-center gap-8 rounded-2xl p-6 sm:p-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          style={{
            backgroundColor: label?.tint ?? UNLABELED.tint,
            color: label?.ink ?? UNLABELED.ink,
          }}
        >
          <Image
            src={label?.image ?? UNLABELED.image}
            alt={
              label
                ? `An otter dressed as ${label.name}`
                : "The otter walking forward with a bag over one shoulder"
            }
            width={1728}
            height={2304}
            className="h-auto w-full rounded-xl"
            priority
          />
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-lg">{`A ${payload.y} job search`}</p>
              {label && (
                <h1 className="text-4xl font-bold sm:text-5xl">{label.name}</h1>
              )}
              {label && <p className="text-lg">{label.description}</p>}
              {!label && (
                <h1 className="text-4xl font-bold sm:text-5xl">
                  A year of showing up
                </h1>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4">
              {stats
                .filter(([value]) => value > 0)
                .map(([value, one, many]) => (
                  <div key={many}>
                    <dt className="sr-only">{many}</dt>
                    <dd className="text-3xl font-bold">
                      {value.toLocaleString("en-US")}
                    </dd>
                    <dd>{value === 1 ? one : many}</dd>
                  </div>
                ))}
            </dl>
            {payload.m !== null && (
              <p>{`Busiest month: ${MONTH_NAMES[payload.m]}`}</p>
            )}
            {payload.hc && (
              <p className="text-xl font-semibold">{`Landed at ${payload.hc}`}</p>
            )}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-xl space-y-4 text-center">
          <h2 className="text-2xl font-bold">
            Your search deserves a record too
          </h2>
          <p className="text-muted-foreground">
            CareerOtter tracks every application, interview and offer, and turns
            your year into a recap like this one.
          </p>
          <Button asChild size="lg">
            {/* Tagged so signups that came from a shared recap are countable. */}
            <Link href={`/signup?ref=yir-${payload.y}`}>Start tracking for free</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
