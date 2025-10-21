/**
 * AnalysisContent Component
 * 
 * Handles the main content area for analysis results and states.
 * Extracted from ApplicationAIAnalysis for better separation of concerns.
 */

import { Button } from "@/components/ui/button";
import { Sparkles, Clock, RotateCcw } from "lucide-react";
import {
  getLoadingAccessibilityProps,
  getErrorAccessibilityProps,
  getTabPanelAccessibilityProps,
  getLiveRegionProps,
} from "@/lib/utils/accessibility";
import { A11Y_CONFIG } from "@/lib/constants/ai-analysis";
import { JobFitAnalysisResult as JobFitAnalysisDisplay } from "@/components/ai-coach/results/JobFitAnalysisResult";
import { InterviewPreparationResult as InterviewPreparationDisplay } from "@/components/ai-coach/results/InterviewPreparationResult";
import { CoverLetterResult as CoverLetterDisplay } from "@/components/ai-coach/results/CoverLetterResult";
import {
  isJobFitAnalysisResult,
  isInterviewPreparationResult,
  isCoverLetterResult,
} from "@/types/ai-analysis";
import { copyAnalysisToClipboard, downloadAnalysisPDF } from "@/lib/utils/analysis-export";
import type { 
  AIAnalysisTab, 
  AnalysisError, 
  AnalysisResult,
  AnalysisStatus,
  AIFeatureConfig 
} from "@/types/ai-analysis";
import type { Application } from "@/types";

interface AnalysisContentProps {
  activeTab: AIAnalysisTab;
  status: AnalysisStatus;
  error: AnalysisError | null;
  analysis: AnalysisResult | null;
  selectedHistoryItem: any;
  currentTabConfig: AIFeatureConfig | undefined;
  application: Application;
  isLoading: boolean;
  canRetry: boolean;
  onGenerateAnalysis: () => Promise<void>;
  onReset: () => void;
  onClearHistoryItem: () => void;
  announceSuccess: (message: string) => void;
  announceError: (message: string) => void;
}

export function AnalysisContent({
  activeTab,
  status,
  error,
  analysis,
  selectedHistoryItem,
  currentTabConfig,
  application,
  isLoading,
  canRetry,
  onGenerateAnalysis,
  onReset,
  onClearHistoryItem,
  announceSuccess,
  announceError,
}: AnalysisContentProps) {
  return (
    <div
      {...getTabPanelAccessibilityProps(activeTab, true)}
      {...getLiveRegionProps("polite", true)}
      className="p-6"
    >
      {status === "idle" && (
        <div className="text-center py-8 space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">
              {currentTabConfig?.label}
            </h3>
            <p className="text-sm text-gray-600">
              {currentTabConfig?.description}
            </p>
            {currentTabConfig?.estimatedTime && (
              <p className="text-xs text-gray-500">
                Estimated time: {currentTabConfig.estimatedTime} seconds
              </p>
            )}
          </div>

          <Button
            onClick={onGenerateAnalysis}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary"
            aria-label={`Generate ${currentTabConfig?.label} for ${application.company} ${application.role} position`}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate {currentTabConfig?.label}
          </Button>
        </div>
      )}

      {status === "loading" && (
        <div
          className="flex items-center justify-center py-12"
          {...getLoadingAccessibilityProps(true, A11Y_CONFIG.loadingLabel)}
        >
          <div className="text-center space-y-3">
            <Sparkles className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {A11Y_CONFIG.loadingLabel}
            </p>
            <div className="flex justify-center">
              <div className="animate-pulse flex space-x-1">
                <div className="w-2 h-2 bg-primary/60 rounded-full"></div>
                <div className="w-2 h-2 bg-primary/60 rounded-full"></div>
                <div className="w-2 h-2 bg-primary/60 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "error" && error && (
        <div
          className="text-center py-8 space-y-4"
          {...getErrorAccessibilityProps(true, error.message)}
          role="alert"
        >
          <div className="text-form-error-text">
            <p className="font-medium">{error.message}</p>
            {error.details && (
              <p className="text-sm mt-1" id="error-message">
                {error.details}
              </p>
            )}
          </div>
          {canRetry && (
            <Button
              onClick={onGenerateAnalysis}
              variant="outline"
              className="border-form-error-border text-form-error-text hover:bg-form-error-bg focus:ring-2 focus:ring-form-error-icon"
              aria-label="Retry analysis generation"
            >
              Try Again
            </Button>
          )}
        </div>
      )}

      {((status === "success" && analysis) ||
        (activeTab === "job-fit" && selectedHistoryItem)) && (
        <div className="space-y-6">
          {selectedHistoryItem && (
            <div 
              className="mb-4 p-3 bg-form-info-bg border border-form-info-border rounded-lg"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-sm text-form-info-text">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>
                  Viewing analysis from{" "}
                  {new Date(
                    selectedHistoryItem.created_at
                  ).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearHistoryItem}
                  className="ml-auto text-form-info-text hover:text-form-info-text/80 h-auto p-1"
                  aria-label="Return to viewing latest analysis"
                >
                  View Latest
                </Button>
              </div>
            </div>
          )}

          {/* Render appropriate analysis result component based on active tab */}
          {activeTab === "job-fit" && (
            <JobFitAnalysisDisplay
              analysis={
                selectedHistoryItem
                  ? selectedHistoryItem.analysis_result
                  : analysis
              }
              onCopy={async () => {
                try {
                  const analysisData = selectedHistoryItem
                    ? selectedHistoryItem.analysis_result
                    : analysis;
                  
                  if (isJobFitAnalysisResult(analysisData)) {
                    await copyAnalysisToClipboard(analysisData);
                    announceSuccess("Analysis copied to clipboard");
                  } else {
                    // Fallback to JSON format for non-job-fit results
                    await navigator.clipboard.writeText(JSON.stringify(analysisData, null, 2));
                    announceSuccess("Analysis results copied to clipboard");
                  }
                } catch (error) {
                  announceError("Failed to copy results");
                }
              }}
              onDownload={async () => {
                try {
                  const analysisData = selectedHistoryItem
                    ? selectedHistoryItem.analysis_result
                    : analysis;
                  
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
                  announceError("Failed to download report");
                }
              }}
            />
          )}

          {/* Interview Preparation Results */}
          {activeTab === "interview" &&
            analysis &&
            isInterviewPreparationResult(analysis) && (
              <InterviewPreparationDisplay
                analysis={analysis}
                onCopy={() => {
                  const questionsText = analysis.questions
                    .map((q) => `${q.question}\n${q.suggestedApproach}`)
                    .join("\n\n");
                  navigator.clipboard
                    .writeText(questionsText)
                    .then(() =>
                      announceSuccess(
                        "Interview questions copied to clipboard"
                      )
                    )
                    .catch(() => announceError("Failed to copy questions"));
                }}
                onDownload={() => {
                  // Download feature not yet implemented
                  announceError("PDF download not available");
                }}
              />
            )}

          {/* Cover Letter Results */}
          {activeTab === "cover-letter" &&
            analysis &&
            isCoverLetterResult(analysis) && (
              <CoverLetterDisplay
                analysis={analysis}
                onCopy={() => {
                  navigator.clipboard
                    .writeText(analysis.fullText)
                    .then(() =>
                      announceSuccess("Cover letter copied to clipboard")
                    )
                    .catch(() =>
                      announceError("Failed to copy cover letter")
                    );
                }}
                onDownload={() => {
                  // Download feature not yet implemented
                  announceError("PDF download not available");
                }}
                onEmail={() => {
                  // Email feature not yet implemented
                  announceError("Email feature not available");
                }}
              />
            )}

          <div className="flex justify-end gap-3">
            {selectedHistoryItem ? (
              <>
                <Button
                  variant="outline"
                  onClick={onClearHistoryItem}
                  className="text-muted-foreground border-border focus:ring-2 focus:ring-primary"
                  aria-label="Clear historical analysis"
                >
                  Close History
                </Button>
                <Button
                  onClick={onGenerateAnalysis}
                  disabled={isLoading}
                  className="bg-secondary hover:bg-secondary/90 focus:ring-2 focus:ring-secondary"
                  aria-label="Generate fresh analysis"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Fresh Analysis
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="text-muted-foreground border-border focus:ring-2 focus:ring-primary"
                  aria-label="Clear analysis results"
                >
                  Reset
                </Button>
                <Button
                  onClick={onGenerateAnalysis}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary"
                  aria-label={`Regenerate ${currentTabConfig?.label}`}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}