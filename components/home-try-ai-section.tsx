import Link from "next/link";
import { ArrowRight, BarChart3, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureIcon, type FeatureIconColor } from "@/components/ui/feature-icon";

const TRY_FEATURES = [
  {
    id: "job-fit",
    title: "Job Fit Analysis",
    description: "Paste any job posting and get your match score with specific gaps to address",
    icon: BarChart3,
    href: "/try/job-fit",
    color: "indigo" as FeatureIconColor,
  },
  {
    id: "cover-letter",
    title: "Cover Letter Generator",
    description: "Generate a ready-to-send cover letter tailored to any role",
    icon: FileText,
    href: "/try/cover-letter",
    color: "green" as FeatureIconColor,
  },
  {
    id: "interview-prep",
    title: "Interview Prep",
    description: "Get likely interview questions with answers tailored to your background",
    icon: MessageSquare,
    href: "/try/interview-prep",
    color: "blue" as FeatureIconColor,
  },
] as const;

export function HomeTryAISection() {
  return (
    <section className="py-16 px-4 bg-muted">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-primary/10 text-primary mb-4">
            Free Preview
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            Try Our AI Career Tools Free
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get job fit scores, AI-written cover letters, and personalized interview questions. See real results before you commit.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {TRY_FEATURES.map((feature) => (
            <Link
              key={feature.id}
              href={feature.href}
              className="group block p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <FeatureIcon icon={feature.icon} color={feature.color} />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {feature.description}
                  </p>
                  <span className="inline-flex items-center text-sm font-medium text-primary">
                    Try it free
                    <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Like what you see? Sign up to save your results and unlock unlimited access.
          </p>
          <Button asChild size="lg">
            <Link href="/signup">
              Create Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
