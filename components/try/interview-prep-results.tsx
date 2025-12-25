"use client";

import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import { PreviewBlurOverlay } from "./preview-blur-overlay";

interface InterviewQuestion {
  id: string;
  category: "behavioral" | "technical" | "situational";
  question: string;
  suggestedApproach?: string;
  difficulty: "easy" | "medium" | "hard";
}

interface InterviewPrepAnalysis {
  questions: InterviewQuestion[];
  generalTips?: string[];
  practiceAreas?: string[];
}

interface InterviewPrepResultsProps {
  analysis: Partial<InterviewPrepAnalysis>;
  isPreview?: boolean;
}

const categoryColors: Record<string, string> = {
  behavioral:
    "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  technical:
    "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
  situational:
    "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
};

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  medium: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  hard: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
};

function QuestionCard({
  question,
  showApproach = false,
}: {
  question: InterviewQuestion;
  showApproach?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        categoryColors[question.category] || categoryColors.behavioral
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium uppercase">
          {question.category}
        </span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            difficultyColors[question.difficulty] || difficultyColors.medium
          )}
        >
          {question.difficulty}
        </span>
      </div>
      <p className="font-medium mb-2">{question.question}</p>
      {showApproach && question.suggestedApproach && (
        <p className="text-sm opacity-80">
          <span className="font-medium">Approach: </span>
          {question.suggestedApproach}
        </p>
      )}
    </div>
  );
}

export function InterviewPrepResults({
  analysis,
  isPreview = false,
}: InterviewPrepResultsProps) {
  const questions = analysis.questions || [];
  const visibleQuestions = isPreview ? questions.slice(0, 3) : questions;
  const hiddenCount = isPreview ? Math.max(0, questions.length - 3) : 0;

  return (
    <div className="space-y-8">
      <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-lg border">
        <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          {questions.length} Questions
        </div>
        <p className="text-muted-foreground">
          Tailored to this role and your background
        </p>
      </div>
      {isPreview ? (
        <PreviewBlurOverlay
          title="Sign up to unlock everything"
          description="Get suggested approaches for each question and practice tips"
        >
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-semibold">Interview Questions</h3>
            </div>
            <div className="space-y-4">
              {visibleQuestions.map((q, i) => (
                <QuestionCard
                  key={q.id || i}
                  question={q}
                  showApproach={!isPreview}
                />
              ))}
            </div>
            {isPreview && hiddenCount > 0 && (
              <p className="text-sm text-muted-foreground mt-3 italic">
                + {hiddenCount} more questions (sign up to see all)
              </p>
            )}
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
              [Hidden - Sign up to see interview tips]
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg text-sm">
              [Hidden - Sign up to see practice areas]
            </div>
          </div>
        </PreviewBlurOverlay>
      ) : (
        <>
          {analysis.generalTips && analysis.generalTips.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">General Tips</h3>
              <ul className="space-y-2">
                {analysis.generalTips.map((tip, i) => (
                  <li
                    key={i}
                    className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.practiceAreas && analysis.practiceAreas.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Practice Areas</h3>
              <ul className="space-y-2">
                {analysis.practiceAreas.map((area, i) => (
                  <li
                    key={i}
                    className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm"
                  >
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
