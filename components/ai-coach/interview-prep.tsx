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
import { generateInterviewPrep } from "@/lib/ai-coach";
import { Loader2, MessageSquare } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

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
  const [userBackground, setUserBackground] = useState("");
  const [prep, setPrep] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const copy = COPY.aiCoach.interviewPrep;

  const handleGenerate = async () => {
    if (!jobDescription) {
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
      // Get user's resume text for context
      const resumeText = await getResumeText();

      // Generate interview prep using AI with resume context
      const generatedPrep = await generateInterviewPrep(
        jobDescription,
        userBackground,
        resumeText || undefined
      );

      setPrep(generatedPrep);

      // Save to database
      if (user?.id) {
        await createInterviewPrep(jobDescription, generatedPrep);
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
          <Textarea
            id="jobDescription"
            placeholder={copy.jobDescriptionPlaceholder}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={8}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userBackground">{copy.backgroundLabel}</Label>
          <Textarea
            id="userBackground"
            placeholder={copy.backgroundPlaceholder}
            value={userBackground}
            onChange={(e) => setUserBackground(e.target.value)}
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
          <div className="space-y-2 pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {copy.generatedTitle}
            </h3>
            <div className="p-4 border rounded-md bg-muted whitespace-pre-wrap text-sm">
              {prep}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InterviewPrep;
