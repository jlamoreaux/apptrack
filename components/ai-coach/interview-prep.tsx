"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { JobDescriptionInput } from "./shared/JobDescriptionInput";
import { AIToolLayout } from "./shared/AIToolLayout";

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
          <MarkdownOutputCard
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
            setInterviewContext(`Interview for ${role} position at ${company}`);
          }
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="interviewContext">{copy.interviewContextLabel}</Label>
            <Textarea
              id="interviewContext"
              placeholder={copy.interviewContextPlaceholder}
              value={interviewContext}
              onChange={(e) => setInterviewContext(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>
    </AIToolLayout>
  );
};

export default InterviewPrep;
