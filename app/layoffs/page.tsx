import { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { NavigationStatic } from "@/components/navigation-static";
import { CheckList } from "@/components/ui/check-list";
import { FileText, Target, MessageSquare, Flame } from "lucide-react";

export const metadata: Metadata = {
  title: "Free Job Search Tools for Laid-Off Workers | AppTrack.ing",
  description:
    "If you were recently laid off, we're giving you 30 days of AppTrack.ing Pro for free. AI-powered job tracking, resume feedback, cover letters, and interview prep.",
  openGraph: {
    title: "Free Month of AppTrack.ing for Laid-Off Workers",
    description:
      "Getting laid off is hard. The job search doesn't have to be chaos. Free 30-day access, no credit card.",
  },
};

const FREE_TOOLS = [
  {
    icon: Flame,
    title: "Resume Roast",
    description: "Brutally honest AI feedback on your resume — the kind recruiters won't give you.",
    href: "/roast-my-resume",
  },
  {
    icon: FileText,
    title: "Cover Letter Generator",
    description: "Tailored to each job description. Ready in under a minute.",
    href: "/try/cover-letter",
  },
  {
    icon: Target,
    title: "Job Fit Checker",
    description: "See how well your resume actually matches before you waste time applying.",
    href: "/try/job-fit",
  },
  {
    icon: MessageSquare,
    title: "Interview Prep",
    description: "Practice questions based on the real job description and your background.",
    href: "/try/interview-prep",
  },
];

export default function LayoffsPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />

      <main className="container mx-auto px-4 py-16 max-w-3xl">
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
        </div>

        {/* Empathy copy */}
        <div className="bg-muted/50 rounded-xl p-6 mb-12 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Getting laid off is disorienting. One day you have a job, the next you're rebuilding from
          scratch. The job market is not exactly patient, and most people respond by mass-applying
          and hoping something sticks. That's usually the worst strategy. AppTrack.ing was built so
          you always know where things stand, what needs attention, and how to put your best foot
          forward. You have enough on your plate. Let the app handle the tracking while you focus on
          landing.
        </div>

        {/* What you get */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">What you get with Pro</h2>
          <CheckList
            items={[
              "One clear home base for every application, follow-up, and interview",
              "AI tools that sharpen your resume, write your cover letters, and prep you for interviews",
              "Job fit analysis so you apply smarter and stop wasting time on roles that won't move forward",
              "Application pipeline tracking so nothing falls through the cracks",
            ]}
          />
        </div>

        {/* Free tools — no account needed */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-2">Free tools — no account needed</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Start right now. No signup required.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {FREE_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex gap-3 p-4 rounded-lg border bg-card hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <tool.icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm group-hover:text-primary transition-colors">
                    {tool.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{tool.description}</div>
                </div>
              </Link>
            ))}
          </div>
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
