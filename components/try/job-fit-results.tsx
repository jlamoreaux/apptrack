"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

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
 * Preview mode: shows real score + first 2 strengths, blurs/fades the rest
 * Full mode: shows everything
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

  const getScoreBg = (score: number) => {
    if (score >= 80) return "from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950";
    if (score >= 60) return "from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950";
    return "from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950";
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
        <>
          {/* Score — real value, prominently displayed */}
          <div className={cn(
            "text-center p-8 bg-gradient-to-br rounded-lg border",
            getScoreBg(fitScore)
          )}>
            <div className={cn("text-7xl font-bold", getScoreColor(fitScore))}>
              {fitScore}%
            </div>
            <p className="text-lg font-semibold mt-2">
              {getScoreLabel(fitScore)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Based on skills match, experience level, and job requirements
            </p>
          </div>

          {/* First 2 strengths — visible */}
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
            </div>
          )}

          {/* Locked section — fades out with blur, flows into SignupGate below */}
          <div className="relative">
            <div
              className="space-y-6 select-none pointer-events-none"
              style={{ filter: "blur(4px)", opacity: 0.5 }}
              aria-hidden="true"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold">Areas to Improve</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Skill gap identified in required technical area</span>
                  </li>
                  <li className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Experience level below job requirements</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold">Recommendation</h3>
                </div>
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  <p className="text-sm">Apply with targeted cover letter addressing experience gaps directly.</p>
                </div>
              </div>
            </div>

            {/* Gradient fade at the bottom of the locked zone */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
        </>
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
