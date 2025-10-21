"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, ArrowRight } from "lucide-react";

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
export function JobFitResults({ analysis, isPreview = false }: JobFitResultsProps) {
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
      {/* Fit Score - Always Visible */}
      <div className="text-center p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border">
        <div className="mb-4">
          <div className={cn("text-7xl font-bold", getScoreColor(fitScore))}>
            {fitScore}%
          </div>
          <p className="text-lg font-medium text-muted-foreground mt-2">
            {getScoreLabel(fitScore)}
          </p>
        </div>

        {/* Score breakdown hint */}
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Based on skills match, experience level, and job requirements alignment
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
              <li key={i} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>

          {isPreview && (
            <p className="text-sm text-muted-foreground mt-3 italic">
              + {3 - (analysis.strengths?.length || 0)} more strengths (sign up to see all)
            </p>
          )}
        </div>
      )}

      {/* Blurred Content in Preview */}
      {isPreview ? (
        <div className="relative">
          {/* Blurred placeholder content */}
          <div className="filter blur-md select-none pointer-events-none space-y-6">
            {/* Gaps */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-semibold">Areas to Improve</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">[Hidden - Sign up to see specific gaps]</span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">[Hidden - Sign up to see specific gaps]</span>
                </li>
              </ul>
            </div>

            {/* Recommendation */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Recommendation</h3>
              </div>
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm">[Hidden - Sign up to see full recommendation and advice]</p>
              </div>
            </div>

            {/* Next Steps */}
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

          {/* Unlock overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-white via-white/95 to-white/50">
            <div className="text-center max-w-md p-6">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                  <svg
                    className="w-8 h-8 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>
              <h4 className="text-xl font-semibold mb-2">
                Sign up to unlock full analysis
              </h4>
              <p className="text-sm text-muted-foreground">
                See your specific gaps, detailed recommendations, and actionable next steps
              </p>
            </div>
          </div>
        </div>
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
                  <li key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
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
                <h3 className="text-lg font-semibold">Potential Deal-Breakers</h3>
              </div>
              <ul className="space-y-3">
                {analysis.redFlags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
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
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm leading-relaxed">{analysis.recommendation}</p>
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
                  <li key={i} className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-medium flex-shrink-0">
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
