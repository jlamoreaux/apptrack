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

const CoverLetterGenerator = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [userBackground, setUserBackground] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateCoverLetter = async () => {
    if (!jobDescription || !userBackground || !companyName) {
      toast({
        title: "Missing Information",
        description:
          "Please provide the company name, your background, and the job description.",
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
        title: "Cover Letter Generated!",
        description: "Your new cover letter has been created successfully.",
      });
    } catch (error) {
      console.error("Error generating cover letter:", error);
      toast({
        title: "Error Generating Cover Letter",
        description:
          (error as Error).message ||
          "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Cover Letter Generator</CardTitle>
        <CardDescription>
          Create a professional cover letter tailored to any job in seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            placeholder="e.g. Google"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userBackground">Your Background / Resume</Label>
          <Textarea
            id="userBackground"
            placeholder="Briefly describe your experience and skills, or paste your resume here."
            value={userBackground}
            onChange={(e) => setUserBackground(e.target.value)}
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobDescription">Job Description</Label>
          <Textarea
            id="jobDescription"
            placeholder="Paste the job description here."
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
          Generate Cover Letter
        </Button>

        {coverLetter && (
          <div className="space-y-2 pt-4">
            <h3 className="text-lg font-semibold">Generated Cover Letter:</h3>
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
