import type { Metadata } from "next";
import { NavigationServer } from "@/components/navigation-server";
import { SITE_CONFIG } from "@/lib/constants/site-config";
import { getUser } from "@/lib/supabase/queries";
import { CareerWaitlistForm } from "./career-waitlist-form";

export const metadata: Metadata = {
  title: "Get promoted faster | AppTrack.ing",
  description:
    "We're building a career companion for AppTrack: track your wins, turn them into a clear, evidence-backed case for your next review, and know your gaps before your manager does. Join the early-access waitlist.",
  openGraph: {
    title: "Get promoted faster with AppTrack.ing",
    description:
      "Track your wins, build the case for your next review, and close your gaps before review season. Join the early-access waitlist.",
  },
  alternates: {
    canonical: `${SITE_CONFIG.url}/career`,
  },
};

export default async function CareerPage() {
  const user = await getUser();
  const userEmail = user?.email ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <NavigationServer variant="marketing" />
      <main id="main-content" className="flex-1">
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            {/* Hero */}
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-foreground leading-tight">
                Get promoted faster.
              </h1>
              <p className="text-lg text-muted-foreground">
                We&apos;re building a career companion for AppTrack: track your
                wins as they happen, turn them into a clear, evidence-backed
                case when review time comes, and know your gaps before your
                manager does. It doesn&apos;t exist yet, but we&apos;re building it now
                and inviting early users to shape it. No fake pricing, no fake
                feature list. Just an honest heads-up when it&apos;s ready to try.
              </p>
            </div>

            {/* Join form */}
            <div className="max-w-md mx-auto mt-10">
              <CareerWaitlistForm userEmail={userEmail} />
            </div>

            {/* What to expect */}
            <p className="max-w-md mx-auto mt-6 text-center text-sm text-muted-foreground">
              We&apos;ll email you once when there&apos;s something real to try. No drip
              sequence, no spam, and you can ignore it if the timing isn&apos;t right.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
