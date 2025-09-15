/**
 * JobFitHistorySection Component
 * 
 * Handles display and management of job fit analysis history.
 * Extracted from ApplicationAIAnalysis for better separation of concerns.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown,
  ChevronRight,
  Clock,
  TrendingUp,
} from "lucide-react";
import { JobFitAnalysisResult as JobFitAnalysisDisplay } from "@/components/ai-coach/results/JobFitAnalysisResult";
import { copyAnalysisToClipboard, downloadAnalysisPDF } from "@/lib/utils/analysis-export";
import { isJobFitAnalysisResult } from "@/types/ai-analysis";
import type { Application } from "@/types";

interface JobFitHistorySectionProps {
  application: Application;
  hasAICoachAccess: () => boolean;
  jobFitHistory: any[];
  historyLoading: boolean;
  showHistory: boolean;
  selectedHistoryItem: any;
  shouldSuggestRefresh: boolean;
  onToggleHistory: () => void;
  onSelectHistoryItem: (item: any) => void;
  onGenerateAnalysis: () => Promise<void>;
  onRefreshSuggestionDismiss: () => void;
  announceSuccess: (message: string) => void;
  announceError: (message: string) => void;
}

export function JobFitHistorySection({
  hasAICoachAccess,
  jobFitHistory,
  historyLoading,
  showHistory,
  selectedHistoryItem,
  shouldSuggestRefresh,
  onToggleHistory,
  onSelectHistoryItem,
  onGenerateAnalysis,
  onRefreshSuggestionDismiss,
  announceSuccess,
  announceError,
}: JobFitHistorySectionProps) {
  if (!hasAICoachAccess()) return null;

  return (
    <div className="border-b border-border bg-muted/30 p-4">
      <button
        onClick={onToggleHistory}
        className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-lg p-2 transition-colors"
        aria-expanded={showHistory}
        aria-controls="job-fit-history"
        aria-label={`${showHistory ? 'Hide' : 'Show'} job fit analysis history`}
      >
        <div className="flex items-center gap-2">
          {showHistory ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            Most Recent Analysis
          </span>
        </div>
        {historyLoading && (
          <div 
            className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"
            aria-label="Loading analysis history"
            role="status"
          ></div>
        )}
      </button>

      {showHistory && (
        <div 
          id="job-fit-history" 
          className="mt-3"
          role="region"
          aria-label="Job fit analysis history"
        >
          {shouldSuggestRefresh && jobFitHistory.length > 0 && (
            <div 
              className="ml-6 p-3 bg-form-warning-bg border border-form-warning-border rounded-lg mb-3"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-form-warning-icon mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-form-warning-text">
                    Consider a fresh analysis
                  </p>
                  <p className="text-xs text-form-warning-text/80 mt-1">
                    Your most recent analysis is over a week old. Generate
                    a new one for the latest insights.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    onRefreshSuggestionDismiss();
                    await onGenerateAnalysis();
                  }}
                  className="text-form-warning-text border-form-warning-border hover:bg-form-warning-bg/50 h-auto py-1 px-2 text-xs"
                  aria-label="Generate fresh analysis to replace old one"
                >
                  Refresh
                </Button>
              </div>
            </div>
          )}

          {jobFitHistory.length === 0 && !historyLoading ? (
            <p 
              className="text-sm text-muted-foreground italic pl-8"
              role="status"
              aria-live="polite"
            >
              No previous analyses found
            </p>
          ) : jobFitHistory.length > 0 ? (
            <div className="ml-6">
              {/* Show the most recent analysis directly */}
              <div 
                className="p-4 rounded-lg border border-border bg-card"
                role="article"
                aria-labelledby="recent-analysis-header"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-status-offer-text" aria-hidden="true" />
                    <span 
                      id="recent-analysis-header"
                      className="font-medium text-sm"
                      aria-label={`${jobFitHistory[0].fit_score} percent job fit match`}
                    >
                      {jobFitHistory[0].fit_score}% Match
                    </span>
                  </div>
                  <span 
                    className="text-xs text-muted-foreground"
                    aria-label={`Generated on ${new Date(jobFitHistory[0].created_at).toLocaleDateString()}`}
                  >
                    {new Date(
                      jobFitHistory[0].created_at
                    ).toLocaleDateString()}
                  </span>
                </div>

                {/* Display the full analysis directly */}
                <div className="mt-3">
                  <JobFitAnalysisDisplay
                    analysis={jobFitHistory[0].analysis_result}
                    onCopy={async () => {
                      try {
                        const analysisData = jobFitHistory[0].analysis_result;
                        
                        if (isJobFitAnalysisResult(analysisData)) {
                          await copyAnalysisToClipboard(analysisData);
                          announceSuccess("Analysis copied to clipboard");
                        } else {
                          await navigator.clipboard.writeText(JSON.stringify(analysisData, null, 2));
                          announceSuccess("Analysis results copied to clipboard");
                        }
                      } catch (error) {
                        console.error('Copy failed:', error);
                        announceError("Failed to copy results");
                      }
                    }}
                    onDownload={async () => {
                      try {
                        const analysisData = jobFitHistory[0].analysis_result;
                        
                        if (isJobFitAnalysisResult(analysisData)) {
                          await downloadAnalysisPDF(analysisData, {
                            company: application.company,
                            role: application.role
                          });
                          announceSuccess("Analysis report downloaded");
                        } else {
                          announceError("PDF download only available for job fit analysis");
                        }
                      } catch (error) {
                        console.error('Download failed:', error);
                        announceError("Failed to download report");
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}