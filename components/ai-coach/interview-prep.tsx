"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { JobDescriptionInput } from "./shared/JobDescriptionInput";
import { AIToolLayout } from "./shared/AIToolLayout";
import { InterviewContextCard } from "./shared/InterviewContextCard";
import { InterviewPrepDisplay } from "./shared/InterviewPrepDisplay";
import { InterviewPrepHistory } from "./shared/InterviewPrepHistory";

interface InterviewPrepProps {
  applicationId?: string;
}

const InterviewPrep = ({ applicationId }: InterviewPrepProps) => {
  const { user } = useSupabaseAuth();
  const {
    createInterviewPrep,
    loading: dalLoading,
    error,
    clearError,
  } = useAICoachClient(user?.id || null);
  const { getResumeText, loading: resumeLoading } = useResumesClient(
    user?.id || null
  );
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewContext, setInterviewContext] = useState("");
  const [prep, setPrep] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const copy = COPY.aiCoach.interviewPrep;

  // Initialize selected application from URL parameter
  useEffect(() => {
    if (applicationId) {
      setSelectedApplicationId(applicationId);
    }
  }, [applicationId]);

  const handleGenerate = async () => {
    if (!jobDescription && !selectedApplicationId) {
      console.log("no job description or selected application");
      toast({
        title: "Job Description Required",
        description:
          ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.MISSING_JOB_DESCRIPTION,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setPrep("");
    clearError();

    try {
      // Call backend API route for interview prep
      const payload: any = { 
        interviewContext,
        jobDescription,
        applicationId: selectedApplicationId || undefined
      };
      const response = await fetch("/api/ai-coach/interview-prep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle structured conversion errors with fallback content
        if (data.fallbackContent) {
          console.warn("Server couldn't convert to structured format, received fallback content");
          toast({
            title: "Partial Success",
            description: data.error + " Raw content was generated but couldn't be formatted properly.",
            variant: "destructive",
          });
          return; // Don't set prep content since we only want structured data
        }
        throw new Error(data.error || "Failed to generate interview prep");
      }

      setPrep(data.preparation);

      // Save to database
      if (user?.id) {
        await createInterviewPrep(jobDescription, data.preparation);
      }

      toast({
        title: copy.successToast.title,
        description: copy.successToast.description,
      });
    } catch (error) {
      console.error("Error generating interview prep:", error);
      toast({
        title: "Error Generating Prep",
        description: (error as Error).message || ERROR_MESSAGES.UNEXPECTED,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isLoadingState = isLoading || dalLoading || resumeLoading;

  return (
    <AIToolLayout
      title={copy.title}
      description={`${copy.description}${resumeLoading ? " Loading your resume for personalized prep..." : ""}`}
      icon={<MessageSquare className="h-5 w-5" />}
      onSubmit={handleGenerate}
      submitLabel={copy.generateButton}
      isLoading={isLoadingState}
      error={error}
      result={
        prep ? (
          <InterviewPrepDisplay
            title={copy.generatedTitle}
            icon={<MessageSquare className="h-5 w-5" />}
            content={prep}
          />
        ) : null
      }
    >
      <JobDescriptionInput
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        label={copy.jobDescriptionLabel}
        placeholder={copy.jobDescriptionPlaceholder}
        onApplicationSelect={(appId, company, role) => {
          setSelectedApplicationId(appId);
          if (company && role) {
            // Only set default context if current context is empty
            setInterviewContext(prev => 
              prev.trim() === "" ? `Interview for ${role} position at ${company}` : prev
            );
          }
        }}
      />

      <InterviewContextCard
        interviewContext={interviewContext}
        onInterviewContextChange={setInterviewContext}
        label={copy.interviewContextLabel}
        placeholder={copy.interviewContextPlaceholder}
      />

      <InterviewPrepHistory
        currentUserId={user?.id}
        onSelectPrep={(loadedPrep) => {
          setPrep(loadedPrep);
        }}
      />
    </AIToolLayout>
  );
};

export default InterviewPrep;
