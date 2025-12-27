"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeBenefit {
  title: string;
  description: string;
}

const DEFAULT_BENEFITS: UpgradeBenefit[] = [
  {
    title: "Unlimited Applications",
    description: "Track as many job applications as you need",
  },
  {
    title: "AI Resume Analysis",
    description: "Get instant feedback to improve your resume",
  },
  {
    title: "Custom Cover Letters",
    description: "Generate tailored cover letters in seconds",
  },
  {
    title: "Interview Preparation",
    description: "Practice with AI-generated interview questions",
  },
  {
    title: "Career Coaching",
    description: "Get personalized career advice anytime",
  },
  {
    title: "Cancel Reminder",
    description: "We'll remind you to cancel when you get hired",
  },
];

interface UpgradeBenefitsProps {
  benefits?: UpgradeBenefit[];
  columns?: 1 | 2 | 3;
  className?: string;
  compact?: boolean;
}

export function UpgradeBenefits({
  benefits = DEFAULT_BENEFITS,
  columns = 2,
  className = "",
  compact = false,
}: UpgradeBenefitsProps) {
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  }[columns];

  if (compact) {
    return (
      <ul className={cn("space-y-2", className)}>
        {benefits.map((benefit, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{benefit.title}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn(`grid ${gridClass} gap-4`, className)}>
      {benefits.map((benefit, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium text-sm">{benefit.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {benefit.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}