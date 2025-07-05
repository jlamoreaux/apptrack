/**
 * JobFitAnalysisResult Component
 * 
 * Displays job fit analysis results in a comprehensive, user-friendly format.
 * Shows overall score, strengths, weaknesses, recommendations, and key requirements.
 * 
 * Features:
 * - Visual score representation with color coding
 * - Expandable sections for detailed information
 * - Progress bars for match details
 * - Accessible design with proper ARIA attributes
 */

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Lightbulb, 
  CheckCircle2,
  Copy,
  Download,
  ExternalLink
} from "lucide-react"
import { useState, useMemo } from "react"
import { useReducedMotion } from "@/lib/utils/accessibility"
import type { JobFitAnalysisResult } from "@/types/ai-analysis"

interface JobFitAnalysisResultProps {
  analysis: JobFitAnalysisResult
  /** Optional className for styling customization */
  className?: string
  /** Callback when user wants to copy results */
  onCopy?: () => void
  /** Callback when user wants to download results */
  onDownload?: () => void
  /** Show action buttons */
  showActions?: boolean
}

export function JobFitAnalysisResult({ 
  analysis, 
  className,
  onCopy,
  onDownload,
  showActions = true
}: JobFitAnalysisResultProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const prefersReducedMotion = useReducedMotion()

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const scoreColor = useMemo(() => {
    const score = analysis.overallScore ?? 0
    if (score >= 85) return 'text-green-600'
    if (score >= 75) return 'text-blue-600'
    if (score >= 65) return 'text-yellow-600'
    return 'text-orange-600'
  }, [analysis.overallScore])

  const scoreBarColor = useMemo(() => {
    const score = analysis.overallScore ?? 0
    if (score >= 85) return 'bg-green-500'
    if (score >= 75) return 'bg-blue-500'
    if (score >= 65) return 'bg-yellow-500'
    return 'bg-orange-500'
  }, [analysis.overallScore])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Overall Score Section */}
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl">Job Fit Analysis</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Generated on {formatDate(analysis.generatedAt)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score Display */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <div className={`text-5xl font-bold ${scoreColor}`}>
                {analysis.overallScore ?? 0}%
              </div>
              <Badge 
                variant="outline" 
                className={`${scoreColor} border-current text-base px-3 py-1`}
              >
                {analysis.scoreLabel || 'No Score Available'}
              </Badge>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress 
                value={analysis.overallScore ?? 0} 
                className="w-full h-3"
                aria-label={`Job fit score: ${analysis.overallScore ?? 0}%`}
              />
              <p className="text-sm text-muted-foreground">
                Overall compatibility with this position
              </p>
            </div>
          </div>

          {/* Match Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Skills Match</p>
              <div className="space-y-1">
                <Progress 
                  value={analysis.matchDetails?.skillsMatch || 0} 
                  className="h-2"
                  aria-label={`Skills match: ${analysis.matchDetails?.skillsMatch || 0}%`}
                />
                <p className="text-sm text-muted-foreground">{analysis.matchDetails?.skillsMatch || 0}%</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Experience Match</p>
              <div className="space-y-1">
                <Progress 
                  value={analysis.matchDetails?.experienceMatch || 0} 
                  className="h-2"
                  aria-label={`Experience match: ${analysis.matchDetails?.experienceMatch || 0}%`}
                />
                <p className="text-sm text-muted-foreground">{analysis.matchDetails?.experienceMatch || 0}%</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Education Match</p>
              <div className="space-y-1">
                <Progress 
                  value={analysis.matchDetails?.educationMatch || 0} 
                  className="h-2"
                  aria-label={`Education match: ${analysis.matchDetails?.educationMatch || 0}%`}
                />
                <p className="text-sm text-muted-foreground">{analysis.matchDetails?.educationMatch || 0}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strengths Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <TrendingUp className="h-5 w-5" />
            Your Strengths
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.strengths && Array.isArray(analysis.strengths) ? (
              analysis.strengths.map((strength, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">{strength}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No strengths data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Areas for Improvement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <TrendingDown className="h-5 w-5" />
            Areas to Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.weaknesses && Array.isArray(analysis.weaknesses) ? (
              analysis.weaknesses.map((weakness, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">{weakness}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No areas for improvement data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Target className="h-5 w-5" />
            Key Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analysis.keyRequirements && Array.isArray(analysis.keyRequirements) ? (
              analysis.keyRequirements.map((requirement, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-xs px-2 py-1"
                >
                  {requirement}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No key requirements data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <Lightbulb className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.recommendations && Array.isArray(analysis.recommendations) ? (
              analysis.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">{recommendation}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No recommendations data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCopy && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCopy}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Results
            </Button>
          )}
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
      )}
    </div>
  )
}