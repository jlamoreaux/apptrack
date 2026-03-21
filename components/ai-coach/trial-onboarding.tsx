"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Briefcase, Mail } from "lucide-react";
import { TRIAL_BUDGET } from "@/lib/constants/ai-limits";

interface TrialOnboardingProps {
  onComplete: () => void;
}

const tools = [
  {
    icon: BarChart3,
    title: "Job Fit Analysis",
    description:
      "See how well your resume matches a job description with a detailed score and recommendations.",
  },
  {
    icon: Briefcase,
    title: "Interview Prep",
    description:
      "Get tailored interview questions and preparation tips based on the role and your background.",
  },
  {
    icon: Mail,
    title: "Cover Letter",
    description:
      "Generate a customized cover letter that highlights your relevant experience for the role.",
  },
];

/**
 * Required onboarding interstitial for free-tier users.
 * Shows all three AI tools and explains the trial budget.
 * Cannot be dismissed without clicking "Got it" — ensures users
 * understand the full product surface before spending budget.
 */
export function TrialOnboarding({ onComplete }: TrialOnboardingProps) {
  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl sm:text-2xl">
          Your AI career tools
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          You have {TRIAL_BUDGET.LIMIT} free analyses to use across any combination of tools.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.title}
                className="rounded-lg border bg-card p-4 text-center space-y-2"
              >
                <Icon className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-semibold">{tool.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tool.description}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Start with Job Fit — paste a job description to see how you match.
        </p>

        <div className="flex justify-center">
          <Button onClick={onComplete} size="lg" className="min-h-[44px]">
            Got it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
