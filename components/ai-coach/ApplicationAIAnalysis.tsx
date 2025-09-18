"use client";

import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Target,
  MessageCircle,
  FileText,
  Sparkles,
  Lock,
  Crown,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { useTabNavigation } from "@/hooks/use-tab-navigation";
import { useNavigation } from "@/lib/utils/navigation";
import {
  getTabAccessibilityProps,
  getTabPanelAccessibilityProps,
  getTabListAccessibilityProps,
  useTabKeyboardNavigation,
  useScreenReaderAnnouncements,
  getLiveRegionProps,
  getLoadingAccessibilityProps,
  getErrorAccessibilityProps,
} from "@/lib/utils/accessibility";
import {
  AI_FEATURES,
  AI_FEATURES_MAP,
  UPGRADE_PROMPT_CONFIG,
  A11Y_CONFIG,
} from "@/lib/constants/ai-analysis";
import type { Application } from "@/types";
import type {
  AnalysisContext,
  AnalysisError,
  AIAnalysisTab,
  JobFitAnalysisResult,
  InterviewPreparationResult,
  CoverLetterResult,
} from "@/types/ai-analysis";
import {
  isJobFitAnalysisResult,
  isInterviewPreparationResult,
  isCoverLetterResult,
} from "@/types/ai-analysis";
import {
  copyAnalysisToClipboard,
  downloadAnalysisPDF,
} from "@/lib/utils/analysis-export";
import { JobFitAnalysisResult as JobFitAnalysisDisplay } from "@/components/ai-coach/results/JobFitAnalysisResult";
import { InterviewPreparationResult as InterviewPreparationDisplay } from "@/components/ai-coach/results/InterviewPreparationResult";
import { CoverLetterResult as CoverLetterDisplay } from "@/components/ai-coach/results/CoverLetterResult";

interface ApplicationAIAnalysisProps {
  application: Application;
  /** Optional className for styling customization */
  className?: string;
  /** Callback fired when analysis is successfully generated */
  onAnalysisComplete?: (tab: AIAnalysisTab, result: unknown) => void;
  /** Callback fired when an error occurs */
  onAnalysisError?: (tab: AIAnalysisTab, error: AnalysisError) => void;
}

/**
 * ApplicationAIAnalysis Component
 *
 * Provides AI-powered analysis features for job applications including:
 * - Job Fit Analysis
 * - Interview Preparation
 * - Cover Letter Generation
 *
 * Features:
 * - Full accessibility support (WCAG 2.1 AA)
 * - Keyboard navigation
 * - Error handling with retry logic
 * - Caching for performance
 * - Subscription-based access control
 */
export function ApplicationAIAnalysis({
  application,
  className,
  onAnalysisComplete,
  onAnalysisError,
}: ApplicationAIAnalysisProps) {
  const { user } = useSupabaseAuth();
  const { hasAICoachAccess, loading: subscriptionLoading } = useSubscription(
    user?.id || null
  );
  const { navigateToUpgrade } = useNavigation();
  const { announceSuccess, announceError, announceLoading } =
    useScreenReaderAnnouncements();

  // Job fit analysis history state - simplified for auto-loading
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [mostRecentAnalysis, setMostRecentAnalysis] = useState<{
    id: string;
    created_at: string;
    fit_score: number;
    analysis_result: JobFitAnalysisResult;
  } | null>(null);
  const [shouldSuggestRefresh, setShouldSuggestRefresh] = useState(false);
  const hasLoadedInitialHistory = useRef(false);

  // Tab navigation with keyboard support
  const { activeTab, setActiveTab, currentTabConfig } = useTabNavigation({
    defaultTab: "job-fit",
    onTabChange: (tab) => {
      announceSuccess(`Switched to ${AI_FEATURES_MAP.get(tab)?.label} tab`);
    },
  });

  const { registerTab, handleKeyDown } = useTabKeyboardNavigation(
    activeTab,
    AI_FEATURES,
    setActiveTab
  );

  // Analysis context for API calls
  const analysisContext = useMemo(
    (): AnalysisContext => ({
      company: application.company,
      role: application.role,
      jobDescription: application.role_link,
      userId: user?.id || "",
      applicationId: application.id,
    }),
    [application, user?.id]
  );

  // Fetch most recent job fit analysis with abort controller
  const fetchMostRecentAnalysis = useCallback(
    async (signal?: AbortSignal) => {
      if (analysisLoading) {
        return; // Prevent concurrent requests
      }

      setAnalysisLoading(true);

      if (!hasAICoachAccess()) {
        setAnalysisLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/ai-coach/job-fit-history?applicationId=${application.id}&limit=1`,
          {
            credentials: "include",
            signal, // Add abort signal support
          }
        );

        if (response.ok) {
          const data = await response.json();
          const analyses = data.analyses || [];

          if (analyses.length > 0) {
            const mostRecent = analyses[0];
            setMostRecentAnalysis(mostRecent);

            // Check if the most recent analysis is older than 7 days
            const daysSinceAnalysis =
              (Date.now() - new Date(mostRecent.created_at).getTime()) /
              (1000 * 60 * 60 * 24);
            setShouldSuggestRefresh(daysSinceAnalysis > 7);
          }
        }
      } catch (error) {
        // Only log error if it's not an abort error and in development
        if (error instanceof Error && error.name !== "AbortError") {
          if (process.env.NODE_ENV === "development") {
          }
          // In production, could send to error tracking service here
        }
      } finally {
        setAnalysisLoading(false);
      }
    },
    [hasAICoachAccess, application.id, analysisLoading]
  );

  // AI Analysis hook with error handling
  const {
    analysis,
    status,
    error,
    generateAnalysis,
    clearAnalysis,
    isLoading,
    canRetry,
  } = useAIAnalysis({
    applicationId: application.id,
    userId: user?.id || "",
    onSuccess: (result) => {
      const tabLabel = currentTabConfig?.label || "Analysis";
      announceSuccess(`${tabLabel} completed successfully`);
      onAnalysisComplete?.(activeTab, result);
    },
    onError: (analysisError) => {
      const tabLabel = currentTabConfig?.label || "Analysis";
      announceError(`${tabLabel} failed: ${analysisError.message}`);
      onAnalysisError?.(activeTab, analysisError);
    },
  });

  const handleGenerateAnalysis = useCallback(async () => {
    if (!hasAICoachAccess || !currentTabConfig) return;

    announceLoading(`Generating ${currentTabConfig.label}...`);
    setMostRecentAnalysis(null); // Clear any existing analysis
    await generateAnalysis(activeTab, analysisContext);

    // Refresh most recent analysis if on job-fit tab
    if (activeTab === "job-fit") {
      setTimeout(() => {
        fetchMostRecentAnalysis(); // Don't pass signal - we want this to complete
      }, 1000); // Small delay to ensure the new analysis is saved
    }
  }, [
    hasAICoachAccess,
    currentTabConfig,
    generateAnalysis,
    activeTab,
    analysisContext,
    announceLoading,
    fetchMostRecentAnalysis,
  ]);

  const handleReset = useCallback(() => {
    clearAnalysis();
    announceSuccess("Analysis cleared");
  }, [clearAnalysis, announceSuccess]);

  const getTabIcon = useCallback((iconName: string) => {
    const iconMap = {
      Target,
      MessageCircle,
      FileText,
    } as const;

    const Icon = iconMap[iconName as keyof typeof iconMap];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  }, []);

  const handleUpgradeClick = useCallback(() => {
    navigateToUpgrade();
  }, [navigateToUpgrade]);

  // Consolidate loading states for cleaner UI logic
  const isAnyLoading = isLoading || analysisLoading || status === "loading";

  // Clear analysis when tab changes to prevent stale data
  useEffect(() => {
    clearAnalysis();
    setMostRecentAnalysis(null);
  }, [activeTab, clearAnalysis]);

  // Reset history loading flag when application changes
  useEffect(() => {
    hasLoadedInitialHistory.current = false;
  }, [application.id]);

  // Load most recent analysis when component mounts and user has access (only once)
  useEffect(() => {
    if (
      hasAICoachAccess() &&
      !subscriptionLoading &&
      !hasLoadedInitialHistory.current
    ) {
      hasLoadedInitialHistory.current = true;

      // Create abort controller for cleanup
      const abortController = new AbortController();

      const loadMostRecent = async () => {
        try {
          await fetchMostRecentAnalysis(abortController.signal);
        } catch (error) {
          // Only log if error is not from abort
          if (error instanceof Error && error.name !== "AbortError") {
            if (process.env.NODE_ENV === "development") {
              console.error("Failed to load most recent analysis:", error.message);
            }
          }
        }
      };

      loadMostRecent();

      // Cleanup function to abort the request on component unmount
      return () => {
        abortController.abort();
      };
    }
  }, [hasAICoachAccess, subscriptionLoading, fetchMostRecentAnalysis]);

  if (subscriptionLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div
            className="animate-pulse"
            {...getLoadingAccessibilityProps(
              true,
              "Loading subscription information"
            )}
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasAICoachAccess) {
    return (
      <Card
        className={`border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 ${
          className || ""
        }`}
      >
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-purple-900">
            <Crown className="h-6 w-6 text-purple-600" />
            {UPGRADE_PROMPT_CONFIG.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-3">
            <p className="text-gray-700">{UPGRADE_PROMPT_CONFIG.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {AI_FEATURES.map((feature) => (
                <div key={feature.id} className="relative">
                  <div className="bg-white rounded-lg p-3 border border-gray-200 opacity-75">
                    <div className="flex items-center gap-2 mb-1">
                      {getTabIcon(feature.icon)}
                      <span className="font-medium text-sm">
                        {feature.label}
                      </span>
                      <Lock className="h-3 w-3 text-gray-400 ml-auto" />
                    </div>
                    <p className="text-xs text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2">
                What's Included:
              </h4>
              <ul className="text-sm text-gray-700 space-y-1">
                {UPGRADE_PROMPT_CONFIG.features.map((feature, index) => (
                  <li key={index}>• {feature}</li>
                ))}
              </ul>
            </div>

            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleUpgradeClick}
              aria-label={`${UPGRADE_PROMPT_CONFIG.buttonText} - opens upgrade page`}
            >
              <Crown className="h-4 w-4 mr-2" />
              {UPGRADE_PROMPT_CONFIG.buttonText}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className || ""}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-primary">
          <Brain className="h-5 w-5 text-primary" />
          AI Analysis
        </CardTitle>
      </CardHeader>

      {/* Tab Navigation */}
      <div className="border-b border-border -mt-2">
        <nav
          {...getTabListAccessibilityProps(A11Y_CONFIG.tablistLabel)}
          onKeyDown={handleKeyDown}
          className="flex px-6"
        >
          {AI_FEATURES.map((feature, index) => (
            <button
              key={feature.id}
              ref={(el) => registerTab(feature.id, el)}
              onClick={() => setActiveTab(feature.id)}
              {...getTabAccessibilityProps(
                feature.id,
                activeTab === feature.id,
                index,
                AI_FEATURES.length
              )}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                activeTab === feature.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5 border-b-2 border-transparent"
              }`}
            >
              {getTabIcon(feature.icon)}
              <span className="hidden sm:inline">{feature.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div
        {...getTabPanelAccessibilityProps(activeTab, true)}
        {...getLiveRegionProps("polite", true)}
      >
        <CardContent className="p-6">
          {analysisLoading && (
            <div
              className="flex items-center justify-center py-12"
              {...getLoadingAccessibilityProps(
                true,
                "Loading existing analysis"
              )}
            >
              <div className="text-center space-y-3">
                <Sparkles className="h-8 w-8 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading existing analysis...
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

          {status === "idle" &&
            !analysisLoading &&
            !(activeTab === "job-fit" && mostRecentAnalysis) && (
              <div className="text-center py-8 space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    {currentTabConfig?.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {currentTabConfig?.description}
                  </p>
                  {currentTabConfig?.estimatedTime && (
                    <p className="text-xs text-muted-foreground">
                      Estimated time: {currentTabConfig.estimatedTime} seconds
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleGenerateAnalysis}
                  disabled={isAnyLoading}
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
                  onClick={handleGenerateAnalysis}
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
            (activeTab === "job-fit" &&
              mostRecentAnalysis &&
              status === "idle")) && (
            <div className="space-y-6">
              {/* Render appropriate analysis result component based on active tab */}
              {activeTab === "job-fit" && (
                <>
                  {(analysis || mostRecentAnalysis?.analysis_result) && (
                    <JobFitAnalysisDisplay
                      analysis={
                        (analysis as JobFitAnalysisResult) ||
                        mostRecentAnalysis?.analysis_result
                      }
                      onCopy={async () => {
                        try {
                          const analysisData =
                            analysis ||
                            (mostRecentAnalysis
                              ? mostRecentAnalysis.analysis_result
                              : null);

                          if (
                            analysisData &&
                            isJobFitAnalysisResult(analysisData)
                          ) {
                            await copyAnalysisToClipboard(analysisData);
                            announceSuccess("Analysis copied to clipboard");
                          } else if (analysisData) {
                            // Fallback for non-job-fit results
                            await navigator.clipboard.writeText(
                              JSON.stringify(analysisData, null, 2)
                            );
                            announceSuccess(
                              "Analysis results copied to clipboard"
                            );
                          }
                        } catch (error) {
                          if (process.env.NODE_ENV === "development") {
                            console.error(
                              "Copy failed:",
                              error instanceof Error
                                ? error.message
                                : "Unknown error"
                            );
                          }
                          announceError("Failed to copy results");
                        }
                      }}
                      onDownload={async () => {
                        try {
                          const analysisData =
                            analysis ||
                            (mostRecentAnalysis
                              ? mostRecentAnalysis.analysis_result
                              : null);

                          if (
                            analysisData &&
                            isJobFitAnalysisResult(analysisData)
                          ) {
                            await downloadAnalysisPDF(analysisData, {
                              company: application.company,
                              role: application.role,
                            });
                            announceSuccess("Analysis report downloaded");
                          } else {
                            announceError(
                              "PDF download only available for job fit analysis"
                            );
                          }
                        } catch (error) {
                          if (process.env.NODE_ENV === "development") {
                            console.error(
                              "Download failed:",
                              error instanceof Error
                                ? error.message
                                : "Unknown error"
                            );
                          }
                          announceError("Failed to download report");
                        }
                      }}
                    />
                  )}
                </>
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
                      // TODO: Implement PDF download functionality
                      announceSuccess("Download feature coming soon");
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
                      // TODO: Implement PDF download functionality
                      announceSuccess("Download feature coming soon");
                    }}
                    onEmail={() => {
                      // TODO: Implement email functionality
                      announceSuccess("Email feature coming soon");
                    }}
                  />
                )}

              <div className="flex justify-end gap-3">
                {mostRecentAnalysis && status === "idle" ? (
                  <Button
                    onClick={handleGenerateAnalysis}
                    disabled={isAnyLoading}
                    className="bg-secondary hover:bg-secondary/90 focus:ring-2 focus:ring-secondary"
                    aria-label="Generate fresh analysis"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Fresh Analysis
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="text-muted-foreground border-border focus:ring-2 focus:ring-primary"
                      aria-label="Clear analysis results"
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={handleGenerateAnalysis}
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
        </CardContent>
      </div>
    </Card>
  );
}
