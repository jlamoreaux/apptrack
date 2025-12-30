"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Brain, FileText } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { AI_THEME } from "@/lib/constants/ai-theme";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useToast } from "@/hooks/use-toast";
import { useRateLimit } from "@/hooks/use-rate-limit";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { AIToolLayout } from "./shared/AIToolLayout";
import { JobDescriptionInput } from "./shared/JobDescriptionInput";
import { ResumeSelector } from "@/components/resume-management/ResumeSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAICoachData } from "@/contexts/ai-coach-data-context";
import { SavedItemCard } from "./shared/SavedItemCard";

interface ResumeAnalyzerProps {
  userId: string;
}

export function ResumeAnalyzer({ userId }: ResumeAnalyzerProps) {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const { data: cachedData, fetchResumeAnalyses, invalidateCache, fetchResume } = useAICoachData();
  const { canUseFeature, limitMessage, incrementUsage } = useRateLimit('resume_analysis');
  const [jobDescription, setJobDescription] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSavedAnalyses, setShowSavedAnalyses] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const copy = COPY.aiCoach.resumeAnalyzer;

  // Fetch saved analyses on mount
  useEffect(() => {
    if (user?.id && !hasInitialized) {
      setHasInitialized(true);
      fetchResumeAnalyses();
    }
  }, [user?.id, hasInitialized, fetchResumeAnalyses]);

  const deleteAnalysis = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-coach/resume-analysis/history?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        invalidateCache('resumeAnalyses');
        await fetchResumeAnalyses(true);
        toast({
          title: "Deleted",
          description: "Resume analysis deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete analysis",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = async () => {
    // Fetch resume text from selected resume or default
    const resumeText = await fetchResume(selectedResumeId || undefined);

    if (!resumeText) {
      setError("Please upload a resume first. You can upload your resume at the top of this page.");
      toast({
        title: "Resume Required",
        description: "Please upload your resume first",
        variant: "destructive",
      });
      return;
    }

    // Check rate limit
    if (!canUseFeature) {
      setError(limitMessage || "You've reached your Resume Analysis limit. Please try again later or upgrade your subscription.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis("");

    try {
      const response = await fetch("/api/ai-coach/analyze-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          resumeText,
          jobDescription: jobDescription || undefined,
          resumeId: selectedResumeId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to analyze resume");
        return;
      }

      setAnalysis(data.analysis);
      // Invalidate cache and refresh saved analyses
      invalidateCache('resumeAnalyses');
      await fetchResumeAnalyses(true);
      // Increment usage on successful analysis
      await incrementUsage();
      toast({
        title: "Analysis complete!",
        description: "Your resume analysis is ready",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to analyze resume"
      );
      toast({
        title: "Analysis failed",
        description: "Failed to analyze resume",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <AIToolLayout
      title={copy.title}
      description={copy.description}
      icon={<Brain className={`h-5 w-5 ${AI_THEME.classes.text.primary}`} />}
      onSubmit={handleAnalyze}
      submitLabel={copy.analyzeButton}
      isLoading={loading}
      error={error}
      result={
        analysis ? (
          <MarkdownOutputCard
            title={copy.analysisTitle}
            icon={<FileText className={`h-5 w-5 ${AI_THEME.classes.text.primary}`} />}
            content={analysis}
          />
        ) : null
      }
      savedItemsCount={cachedData.savedResumeAnalyses?.length || 0}
      onViewSaved={() => setShowSavedAnalyses(!showSavedAnalyses)}
    >
      {showSavedAnalyses && cachedData.savedResumeAnalyses && cachedData.savedResumeAnalyses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Saved Resume Analyses</CardTitle>
            <CardDescription>
              Previously generated resume analyses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cachedData.savedResumeAnalyses.map((savedAnalysis: any) => (
                <SavedItemCard
                  key={savedAnalysis.id}
                  id={savedAnalysis.id}
                  title="Resume Analysis"
                  subtitle={savedAnalysis.job_description ? "With job description" : "General analysis"}
                  timestamp={savedAnalysis.created_at}
                  onSelect={() => {
                    setAnalysis(savedAnalysis.analysis_result);
                    setShowSavedAnalyses(false);
                  }}
                  onDelete={() => deleteAnalysis(savedAnalysis.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ResumeSelector
              userId={user.id}
              selectedResumeId={selectedResumeId}
              onSelect={setSelectedResumeId}
              placeholder="Use default resume..."
              allowDefault={true}
            />
            <p className="text-xs text-muted-foreground">
              Choose which resume to analyze
            </p>
          </CardContent>
        </Card>
      )}

      <JobDescriptionInput
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        label="Job Description for Targeted Analysis (Optional)"
        placeholder="Paste the job description to get targeted feedback..."
        onApplicationSelect={(appId, company, role) => {
          setSelectedApplicationId(appId);
        }}
      />
    </AIToolLayout>
  );
}
