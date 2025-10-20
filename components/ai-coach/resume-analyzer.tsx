"use client";

import type React from "react";

import { useState } from "react";
import { Brain, FileText } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { AI_THEME } from "@/lib/constants/ai-theme";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useToast } from "@/hooks/use-toast";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { AIToolLayout } from "./shared/AIToolLayout";
import { ResumeAndJobInput } from "./shared/ResumeAndJobInput";

interface ResumeAnalyzerProps {
  userId: string;
}

export function ResumeAnalyzer({ userId }: ResumeAnalyzerProps) {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const copy = COPY.aiCoach.resumeAnalyzer;


  const handleResumeUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.FILE_TOO_LARGE);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.INVALID_FILE_TYPE);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.RESUME_PROCESSING_FAILED
        );
      }

      // Handle both old and new response formats
      const extractedText = data.text || data.resume?.extracted_text;
      if (extractedText) {
        setResumeText(extractedText);
      }
      toast({
        title: "Resume uploaded",
        description: "Your resume has been processed successfully",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.RESUME_PROCESSING_FAILED
      );
      toast({
        title: "Upload failed",
        description: "Failed to process resume file",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText) {
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_RESUME);
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to analyze resume");
        return;
      }

      setAnalysis(data.analysis);
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
      savedItemsCount={savedAnalyses.length}
      onViewSaved={() => {}}
    >
      <ResumeAndJobInput
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        resumeText={resumeText}
        setResumeText={setResumeText}
        jobDescriptionLabel="Job Description for Targeted Analysis"
        jobDescriptionOptional={true}
        allowResumeUpload={true}
        onResumeUpload={handleResumeUpload}
      />
    </AIToolLayout>
  );
}
