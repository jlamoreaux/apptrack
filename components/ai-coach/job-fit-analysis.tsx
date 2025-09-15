"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useRateLimit } from "@/hooks/use-rate-limit";
import { JobDescriptionInput } from "./shared/JobDescriptionInput";
import { AIToolLayout } from "./shared/AIToolLayout";
import { useToast } from "@/hooks/use-toast";

interface MatchDetail {
  category: string;
  score: number;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}

interface JobFitResult {
  overallScore: number;
  summary: string;
  matchDetails: MatchDetail[];
  recommendations: string[];
  keyStrengths: string[];
  areasForImprovement: string[];
}

export function JobFitAnalysis() {
  const [jobDescription, setJobDescription] = useState("");
  const [applicationId, setApplicationId] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<JobFitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { checkLimit } = useRateLimit();
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      setError("Please enter a job description");
      return;
    }

    // Check rate limit
    const canProceed = await checkLimit("job_fit_analysis");
    if (!canProceed) {
      setError("You've reached your Job Fit Analysis limit. Please try again later or upgrade your subscription.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai-coach/job-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          jobDescription,
          applicationId: applicationId || undefined 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze job fit");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { variant: "success" as const, text: "Excellent Match" };
    if (score >= 60) return { variant: "warning" as const, text: "Good Match" };
    return { variant: "destructive" as const, text: "Needs Work" };
  };

  return (
    <AIToolLayout
      title="Job Fit Analysis"
      description="Analyze how well your profile matches job requirements and get personalized recommendations"
      icon={<Target className="h-5 w-5" />}
      onSubmit={handleAnalyze}
      submitLabel="Analyze Job Fit"
      isLoading={isAnalyzing}
      error={error}
      result={
        result ? (
        <div className="space-y-6">
          {/* Overall Score Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Overall Match Score</CardTitle>
                <Badge {...getScoreBadge(result.overallScore)}>
                  {getScoreBadge(result.overallScore).text}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
                  {result.overallScore}%
                </div>
                <Progress value={result.overallScore} className="flex-1" />
              </div>
              <p className="text-muted-foreground">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Match Details */}
          <div className="grid gap-4">
            {result.matchDetails.map((detail, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{detail.category}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${getScoreColor(detail.score)}`}>
                        {detail.score}%
                      </span>
                      <Progress value={detail.score} className="w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {detail.strengths.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <h4 className="font-medium text-green-600">Strengths</h4>
                      </div>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-6">
                        {detail.strengths.map((strength, i) => (
                          <li key={i}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.gaps.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <h4 className="font-medium text-red-600">Gaps</h4>
                      </div>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-6">
                        {detail.gaps.map((gap, i) => (
                          <li key={i}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.suggestions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <h4 className="font-medium text-blue-600">Suggestions</h4>
                      </div>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-6">
                        {detail.suggestions.map((suggestion, i) => (
                          <li key={i}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Key Strengths & Improvements */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.keyStrengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <span className="text-sm">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.areasForImprovement.map((area, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span className="text-sm">{area}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="font-semibold text-primary">{i + 1}.</span>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        ) : null
      }
    >
      <JobDescriptionInput
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        onApplicationSelect={(appId, company, role) => {
          setApplicationId(appId);
          if (company && role) {
            toast({
              title: "Application Loaded",
              description: `Analyzing fit for ${role} at ${company}`,
            });
          }
        }}
      />
    </AIToolLayout>
  );
}