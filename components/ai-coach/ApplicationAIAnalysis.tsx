"use client"

import { useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Target, 
  MessageCircle, 
  FileText, 
  Sparkles,
  Lock,
  Crown,
  ArrowRight
} from "lucide-react"
import { useSubscription } from "@/hooks/use-subscription"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { useAIAnalysis } from "@/hooks/use-ai-analysis"
import { useTabNavigation } from "@/hooks/use-tab-navigation"
import { useNavigation } from "@/lib/utils/navigation"
import {
  getTabAccessibilityProps,
  getTabPanelAccessibilityProps,
  getTabListAccessibilityProps,
  useTabKeyboardNavigation,
  useScreenReaderAnnouncements,
  getLiveRegionProps,
  getLoadingAccessibilityProps,
  getErrorAccessibilityProps,
} from "@/lib/utils/accessibility"
import {
  AI_FEATURES,
  AI_FEATURES_MAP,
  UPGRADE_PROMPT_CONFIG,
  A11Y_CONFIG,
} from "@/lib/constants/ai-analysis"
import type { Application } from "@/types"
import type { 
  AnalysisContext, 
  AnalysisError,
  AIAnalysisTab,
  JobFitAnalysisResult,
  InterviewPreparationResult,
  CoverLetterResult
} from "@/types/ai-analysis"
import { 
  isJobFitAnalysisResult,
  isInterviewPreparationResult,
  isCoverLetterResult
} from "@/types/ai-analysis"
import { JobFitAnalysisResult as JobFitAnalysisDisplay } from "@/components/ai-coach/results/JobFitAnalysisResult"
import { InterviewPreparationResult as InterviewPreparationDisplay } from "@/components/ai-coach/results/InterviewPreparationResult"
import { CoverLetterResult as CoverLetterDisplay } from "@/components/ai-coach/results/CoverLetterResult"

interface ApplicationAIAnalysisProps {
  application: Application
  /** Optional className for styling customization */
  className?: string
  /** Callback fired when analysis is successfully generated */
  onAnalysisComplete?: (tab: AIAnalysisTab, result: unknown) => void
  /** Callback fired when an error occurs */
  onAnalysisError?: (tab: AIAnalysisTab, error: AnalysisError) => void
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
  onAnalysisError 
}: ApplicationAIAnalysisProps) {
  const { user } = useSupabaseAuth()
  const { hasAICoachAccess, loading: subscriptionLoading } = useSubscription(user?.id || null)
  const { navigateToUpgrade } = useNavigation()
  const { announceSuccess, announceError, announceLoading } = useScreenReaderAnnouncements()

  // Tab navigation with keyboard support
  const { activeTab, setActiveTab, currentTabConfig } = useTabNavigation({
    defaultTab: 'job-fit',
    onTabChange: (tab) => {
      announceSuccess(`Switched to ${AI_FEATURES_MAP.get(tab)?.label} tab`)
    },
  })

  const { registerTab, handleKeyDown } = useTabKeyboardNavigation(
    activeTab,
    AI_FEATURES,
    setActiveTab
  )

  // Analysis context for API calls
  const analysisContext = useMemo((): AnalysisContext => ({
    company: application.company,
    role: application.role,
    jobDescription: application.role_link,
    userId: user?.id || '',
    applicationId: application.id,
  }), [application, user?.id])

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
    userId: user?.id || '',
    onSuccess: (result) => {
      const tabLabel = currentTabConfig?.label || 'Analysis'
      announceSuccess(`${tabLabel} completed successfully`)
      onAnalysisComplete?.(activeTab, result)
    },
    onError: (analysisError) => {
      const tabLabel = currentTabConfig?.label || 'Analysis'
      announceError(`${tabLabel} failed: ${analysisError.message}`)
      onAnalysisError?.(activeTab, analysisError)
    },
  })

  const handleGenerateAnalysis = useCallback(async () => {
    if (!hasAICoachAccess || !currentTabConfig) return
    
    announceLoading(`Generating ${currentTabConfig.label}...`)
    await generateAnalysis(activeTab, analysisContext)
  }, [hasAICoachAccess, currentTabConfig, generateAnalysis, activeTab, analysisContext, announceLoading])

  const handleReset = useCallback(() => {
    clearAnalysis()
    announceSuccess('Analysis cleared')
  }, [clearAnalysis, announceSuccess])

  const getTabIcon = useCallback((iconName: string) => {
    const iconMap = {
      Target,
      MessageCircle,
      FileText,
    } as const
    
    const Icon = iconMap[iconName as keyof typeof iconMap]
    return Icon ? <Icon className="h-4 w-4" /> : null
  }, [])

  const handleUpgradeClick = useCallback(() => {
    navigateToUpgrade()
  }, [navigateToUpgrade])

  // Clear analysis when tab changes to prevent stale data
  useEffect(() => {
    clearAnalysis()
  }, [activeTab, clearAnalysis])

  if (subscriptionLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div 
            className="animate-pulse"
            {...getLoadingAccessibilityProps(true, 'Loading subscription information')}
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hasAICoachAccess) {
    return (
      <Card className={`border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 ${className || ''}`}>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-purple-900">
            <Crown className="h-6 w-6 text-purple-600" />
            {UPGRADE_PROMPT_CONFIG.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-3">
            <p className="text-gray-700">
              {UPGRADE_PROMPT_CONFIG.description}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {AI_FEATURES.map((feature) => (
                <div key={feature.id} className="relative">
                  <div className="bg-white rounded-lg p-3 border border-gray-200 opacity-75">
                    <div className="flex items-center gap-2 mb-1">
                      {getTabIcon(feature.icon)}
                      <span className="font-medium text-sm">{feature.label}</span>
                      <Lock className="h-3 w-3 text-gray-400 ml-auto" />
                    </div>
                    <p className="text-xs text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2">What's Included:</h4>
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
    )
  }

  return (
    <Card className={`overflow-hidden ${className || ''}`}>
      <CardHeader className="border-b border-gray-200 pb-0">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Brain className="h-5 w-5 text-blue-600" />
          AI Analysis
        </CardTitle>
      </CardHeader>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav 
          {...getTabListAccessibilityProps(A11Y_CONFIG.tablistLabel)}
          onKeyDown={handleKeyDown}
          className="flex"
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
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                activeTab === feature.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
        {...getLiveRegionProps('polite', true)}
      >
        <CardContent className="p-6">
          {status === 'idle' && (
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
                onClick={handleGenerateAnalysis}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                aria-label={`Generate ${currentTabConfig?.label} for ${application.company} ${application.role} position`}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate {currentTabConfig?.label}
              </Button>
            </div>
          )}

          {status === 'loading' && (
            <div 
              className="flex items-center justify-center py-12"
              {...getLoadingAccessibilityProps(true, A11Y_CONFIG.loadingLabel)}
            >
              <div className="text-center space-y-3">
                <Sparkles className="h-8 w-8 mx-auto animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">
                  {A11Y_CONFIG.loadingLabel}
                </p>
                <div className="flex justify-center">
                  <div className="animate-pulse flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && error && (
            <div 
              className="text-center py-8 space-y-4"
              {...getErrorAccessibilityProps(true, error.message)}
              role="alert"
            >
              <div className="text-red-600">
                <p className="font-medium">{error.message}</p>
                {error.details && (
                  <p className="text-sm mt-1" id="error-message">{error.details}</p>
                )}
              </div>
              {canRetry && (
                <Button
                  onClick={handleGenerateAnalysis}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500"
                  aria-label="Retry analysis generation"
                >
                  Try Again
                </Button>
              )}
            </div>
          )}

          {status === 'success' && analysis && (
            <div className="space-y-6">
              {/* Render appropriate analysis result component based on active tab */}
              {activeTab === 'job-fit' && isJobFitAnalysisResult(analysis) && (
                <JobFitAnalysisDisplay 
                  analysis={analysis}
                  onCopy={() => {
                    navigator.clipboard.writeText(JSON.stringify(analysis, null, 2))
                      .then(() => announceSuccess('Analysis results copied to clipboard'))
                      .catch(() => announceError('Failed to copy results'))
                  }}
                  onDownload={() => {
                    // TODO: Implement PDF download functionality
                    announceSuccess('Download feature coming soon')
                  }}
                />
              )}

              {/* Interview Preparation Results */}
              {activeTab === 'interview' && isInterviewPreparationResult(analysis) && (
                <InterviewPreparationDisplay 
                  analysis={analysis}
                  onCopy={() => {
                    const questionsText = analysis.questions
                      .map(q => `${q.question}\n${q.suggestedApproach}`)
                      .join('\n\n')
                    navigator.clipboard.writeText(questionsText)
                      .then(() => announceSuccess('Interview questions copied to clipboard'))
                      .catch(() => announceError('Failed to copy questions'))
                  }}
                  onDownload={() => {
                    // TODO: Implement PDF download functionality
                    announceSuccess('Download feature coming soon')
                  }}
                />
              )}

              {/* Cover Letter Results */}
              {activeTab === 'cover-letter' && isCoverLetterResult(analysis) && (
                <CoverLetterDisplay 
                  analysis={analysis}
                  onCopy={() => {
                    navigator.clipboard.writeText(analysis.fullText)
                      .then(() => announceSuccess('Cover letter copied to clipboard'))
                      .catch(() => announceError('Failed to copy cover letter'))
                  }}
                  onDownload={() => {
                    // TODO: Implement PDF download functionality
                    announceSuccess('Download feature coming soon')
                  }}
                  onEmail={() => {
                    // TODO: Implement email functionality
                    announceSuccess('Email feature coming soon')
                  }}
                />
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="text-gray-600 border-gray-200 focus:ring-2 focus:ring-gray-500"
                  aria-label="Clear analysis results"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleGenerateAnalysis}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                  aria-label={`Regenerate ${currentTabConfig?.label}`}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  )
}