"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { PreviewBlurOverlay } from "./preview-blur-overlay";

interface JobFitAnalysis {
  fitScore: number;
  strengths: string[];
  gaps: string[];
  redFlags?: string[];
  recommendation: string;
  nextSteps: string[];
}

interface JobFitResultsProps {
  analysis: Partial<JobFitAnalysis>;
  isPreview?: boolean;
}

/**
 * Display job fit analysis results
 * Shows partial content in preview mode (before signup)
 * Shows full content after signup
 */
export function JobFitResults({
  analysis,
  isPreview = false,
}: JobFitResultsProps) {
  const fitScore = analysis.fitScore || 0;

  // Determine score color and label
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Strong Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Fair Match";
    return "Weak Match";
  };

  return (
    <div className="space-y-8">
      {isPreview ? (
        <PreviewBlurOverlay
          title="Sign up to unlock full analysis"
          description="See your specific gaps, detailed recommendations, and actionable next steps"
        >
          {/* Fit Score - Teaser in Preview, Full in Unlocked */}
          <div className="text-center p-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-lg border">
            <div className="mb-4">
              {isPreview ? (
                <>
                  <div className="text-7xl font-bold text-green-500/60 blur-lg select-none pointer-events-none">
                    57%
                  </div>
                  <p className="text-lg font-medium text-muted-foreground mt-2">
                    Your Match Score is Ready!
                  </p>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      "text-7xl font-bold",
                      getScoreColor(fitScore)
                    )}
                  >
                    {fitScore}%
                  </div>
                  <p className="text-lg font-medium text-muted-foreground mt-2">
                    {getScoreLabel(fitScore)}
                  </p>
                </>
              )}
            </div>

            {/* Score breakdown hint */}
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {isPreview
                ? "Sign up to reveal your personalized match score"
                : "Based on skills match, experience level, and job requirements alignment"}
            </p>
          </div>

          {/* Strengths - Partial in Preview */}
          {analysis.strengths && analysis.strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Your Strengths</h3>
              </div>
              <ul className="space-y-3">
                {analysis.strengths.map((strength, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>

              {isPreview && (
                <p className="text-sm text-muted-foreground mt-3 italic">
                  + {3 - (analysis.strengths?.length || 0)} more strengths (sign
                  up to see all)
                </p>
              )}
            </div>
          )}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-semibold">Areas to Improve</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">
                    [Hidden - Sign up to see specific gaps]
                  </span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">
                    [Hidden - Sign up to see specific gaps]
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Recommendation</h3>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <p className="text-sm">
                  [Hidden - Sign up to see full recommendation]
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ArrowRight className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold">Next Steps</h3>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <span className="text-purple-600 mt-1">1.</span>
                  <span>[Hidden - Sign up to see actionable next steps]</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <span className="text-purple-600 mt-1">2.</span>
                  <span>[Hidden - Sign up to see actionable next steps]</span>
                </li>
              </ul>
            </div>
          </div>
        </PreviewBlurOverlay>
      ) : (
        /* Full Content - After Signup */
        <>
          {/* Gaps */}
          {analysis.gaps && analysis.gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-semibold">Areas to Improve</h3>
              </div>
              <ul className="space-y-3">
                {analysis.gaps.map((gap, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg"
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red Flags */}
          {analysis.redFlags && analysis.redFlags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold">
                  Potential Deal-Breakers
                </h3>
              </div>
              <ul className="space-y-3">
                {analysis.redFlags.map((flag, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg"
                  >
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {analysis.recommendation && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Our Recommendation</h3>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <p className="text-sm leading-relaxed">
                  {analysis.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Next Steps */}
          {analysis.nextSteps && analysis.nextSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ArrowRight className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold">Actionable Next Steps</h3>
              </div>
              <ul className="space-y-3">
                {analysis.nextSteps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg"
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 dark:bg-purple-500 text-white text-xs font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm">{step}</span>
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
