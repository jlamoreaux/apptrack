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
import { generateCoverLetter } from "@/lib/ai-coach";
import { Loader2 } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";

const CoverLetterGenerator = () => {
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
    try {
      const response = await generateCoverLetter(
        jobDescription,
        userBackground,
        companyName
      );
      setCoverLetter(response);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
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

        <Button
          onClick={handleGenerateCoverLetter}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
