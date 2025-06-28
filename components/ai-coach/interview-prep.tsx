"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, MessageSquare } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { ResumePreviewUpload } from "./shared/ResumePreviewUpload";
import { JobDescriptionInputTabs } from "./shared/JobDescriptionInputTabs";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";

const InterviewPrep = () => {
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
  const [jobDescription, setJobDescription] = useState("");
  const [interviewContext, setInterviewContext] = useState("");
  const [prep, setPrep] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const copy = COPY.aiCoach.interviewPrep;
  const [inputMethod, setInputMethod] = useState<"text" | "url">("text");
  const [jobUrl, setJobUrl] = useState("");

  const handleGenerate = async () => {
    if (!jobDescription && !jobUrl) {
      console.log("no job description or job url");
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
      const payload: any = { interviewContext };
      if (inputMethod === "url") {
        payload.jobUrl = jobUrl;
      } else {
        payload.jobDescription = jobDescription;
      }
      const response = await fetch("/api/ai-coach/interview-prep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>
          {copy.description}
          {resumeLoading ? " Loading your resume for personalized prep..." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="jobDescription">{copy.jobDescriptionLabel}</Label>
          <JobDescriptionInputTabs
            inputMethod={inputMethod}
            setInputMethod={setInputMethod}
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            jobUrl={jobUrl}
            setJobUrl={setJobUrl}
            jobDescriptionPlaceholder={copy.jobDescriptionPlaceholder}
            jobUrlPlaceholder={"https://company.com/jobs/position"}
          />
        </div>

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

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isLoadingState}
          className="w-full"
        >
          {isLoadingState ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {copy.generateButton}
        </Button>

        {prep && (
          <MarkdownOutputCard
            title={copy.generatedTitle}
            icon={<MessageSquare className="h-5 w-5" />}
            content={prep}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default InterviewPrep;
