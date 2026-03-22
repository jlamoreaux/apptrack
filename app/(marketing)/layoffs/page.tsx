import { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/constants/site-config";
import { ButtonLink } from "@/components/ui/button-link";
import { NavigationStatic } from "@/components/navigation-static";
import { CheckList } from "@/components/ui/check-list";

export const metadata: Metadata = {
  title: "Free Job Search Tools for Laid-Off Workers | AppTrack.ing",
  description:
    "If you were recently laid off, we're giving you 30 days of AppTrack.ing Pro for free. AI-powered job tracking, resume feedback, cover letters, and interview prep.",
  openGraph: {
    title: "Free Month of AppTrack.ing for Laid-Off Workers",
    description:
      "Getting laid off is hard. The job search doesn't have to be chaos. Free 30-day access, no credit card.",
  },
  alternates: {
    canonical: `${SITE_CONFIG.url}/layoffs`,
  },
};

export default function LayoffsPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />

      <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl">
        {/* Hero */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary leading-tight">
            Your next job starts here.
            <br />
            Not in a panic.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            If you were recently laid off, we're giving you 30 days of AppTrack.ing Pro for free.
            No credit card. No strings.
          </p>
          <ButtonLink href="/signup?intent=layoff-offer" size="lg" className="mt-2">
            Claim Your Free Month
          </ButtonLink>
          {/* Product screenshot */}
          <div className="mt-8 rounded-xl overflow-hidden border shadow-md">
            <img
              src="/screenshots/hero/dashboard-clean.png"
              alt="AppTrack job application pipeline"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* What you get */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">What you get with Pro</h2>
          <CheckList
            items={[
              "Know your fit score before you write the cover letter — AI analysis against your actual resume",
              "AI-generated cover letters and interview prep tailored to each job description",
              "One dashboard for every application, follow-up, and interview — nothing falls through",
              "Pipeline tracking built for a job search under pressure, not a spreadsheet hack",
            ]}
          />
        </div>

        {/* Final CTA */}
        <div className="text-center space-y-3 pt-4 border-t">
          <p className="text-muted-foreground text-sm">
            Ready to run a smarter job search?
          </p>
          <ButtonLink href="/signup?intent=layoff-offer" size="lg">
            Claim Your Free Month
          </ButtonLink>
          <p className="text-xs text-muted-foreground">No credit card. Cancel anytime.</p>
        </div>
      </main>
    </div>
  );
}
