"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Sparkles, AlertCircle, TrendingUp, TrendingDown, Target } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface JobAnalysisCardProps {
  jobUrl: string
  userId: string
  companyName: string
  roleName: string
}

interface AnalysisResult {
  overallScore: number
  scoreLabel: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  keyRequirements: string[]
}

export function JobAnalysisCard({ jobUrl, userId, companyName, roleName }: JobAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleAnalyze = async () => {
    setLoading(true)
    setError("")
    setAnalysis(null)

    try {
      const response = await fetch("/api/ai-coach/analyze-job-fit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobUrl,
          companyName,
          roleName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze job fit")
      }

      setAnalysis(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          AI Job Fit Analysis
        </CardTitle>
        <CardDescription>Get AI-powered insights on how well you match this position</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && !loading && (
          <Button onClick={handleAnalyze} className="w-full bg-blue-600 hover:bg-blue-700">
            <Brain className="h-4 w-4 mr-2" />
            Analyze Job Fit
          </Button>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Sparkles className="h-8 w-8 mx-auto animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Analyzing job requirements...</p>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Overall Match Score</h3>
              </div>
              <div className="space-y-2">
                <div className={`text-3xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                  {analysis.overallScore}%
                </div>
                <Badge variant="outline" className={getScoreColor(analysis.overallScore)}>
                  {analysis.scoreLabel}
                </Badge>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getScoreBarColor(analysis.overallScore)}`}
                    style={{ width: `${analysis.overallScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Strengths */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-green-700">
                <TrendingUp className="h-4 w-4" />
                Your Strengths
              </h4>
              <div className="space-y-1">
                {analysis.strengths.map((strength, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm">{strength}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Areas for Improvement */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-orange-700">
                <TrendingDown className="h-4 w-4" />
                Areas to Address
              </h4>
              <div className="space-y-1">
                {analysis.weaknesses.map((weakness, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm">{weakness}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Requirements */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-blue-700">
                <Target className="h-4 w-4" />
                Key Requirements
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.keyRequirements.map((requirement, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {requirement}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-purple-700">
                <Sparkles className="h-4 w-4" />
                Recommendations
              </h4>
              <div className="space-y-1">
                {analysis.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
