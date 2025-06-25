"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useResumesClient } from "@/hooks/use-resumes-client";

const CoverLetterGenerator = () => {
  const { user } = useSupabaseAuth();
  const {
    createCoverLetter,
    loading: dalLoading,
    error,
    clearError,
  } = useAICoachClient(user?.id || null);
  const { getResumeText, loading: resumeLoading } = useResumesClient(
    user?.id || null
  );
  const [jobDescription, setJobDescription] = useState("");
  const [userBackground, setUserBackground] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const copy = COPY.aiCoach.coverLetterGenerator;

  const handleGenerateCoverLetter = async () => {
    if (!jobDescription || !userBackground || !companyName) {
      toast({
        title: "Missing Information",
        description: ERROR_MESSAGES.AI_COACH.COVER_LETTER.MISSING_INFO,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setCoverLetter("");
    clearError();

    try {
      // Call backend API route for cover letter generation
      const response = await fetch("/api/ai-coach/cover-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription,
          userBackground,
          companyName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate cover letter");
      }

      setCoverLetter(data.coverLetter);

      // Save to database
      if (user?.id) {
        await createCoverLetter(jobDescription, data.coverLetter);
      }

      toast({
        title: copy.successToast.title,
        description: copy.successToast.description,
      });
    } catch (error) {
      console.error("Error generating cover letter:", error);
      toast({
        title: "Error Generating Cover Letter",
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
          {resumeLoading
            ? " Loading your resume for personalized cover letter..."
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName">{copy.companyNameLabel}</Label>
          <Input
            id="companyName"
            placeholder={copy.companyNamePlaceholder}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userBackground">{copy.backgroundLabel}</Label>
          <Textarea
            id="userBackground"
            placeholder={copy.backgroundPlaceholder}
            value={userBackground}
            onChange={(e) => setUserBackground(e.target.value)}
            rows={6}
          />
        </div>

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

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <Button
          onClick={handleGenerateCoverLetter}
          disabled={isLoadingState}
          className="w-full"
        >
          {isLoadingState ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {copy.generateButton}
        </Button>

        {coverLetter && (
          <div className="space-y-2 pt-4">
            <h3 className="text-lg font-semibold">{copy.generatedTitle}</h3>
            <div className="p-4 border rounded-md bg-muted whitespace-pre-wrap text-sm">
              {coverLetter}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CoverLetterGenerator;
