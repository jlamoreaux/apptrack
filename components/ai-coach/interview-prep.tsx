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

const InterviewPrep = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [userBackground, setUserBackground] = useState("");
  const [prep, setPrep] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!jobDescription) {
      toast({
        title: "Job Description Required",
        description: "Please provide a job description to get interview prep.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setPrep("");
    try {
      const response = await generateInterviewPrep(
        jobDescription,
        userBackground
      );
      setPrep(response);
      toast({
        title: "Interview Prep Generated!",
        description: "Your personalized interview prep is ready.",
      });
    } catch (error) {
      console.error("Error generating interview prep:", error);
      toast({
        title: "Error Generating Prep",
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
        <CardTitle>AI Interview Prep</CardTitle>
        <CardDescription>
          Get tailored interview questions and talking points based on the job
          description.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="space-y-2">
          <Label htmlFor="userBackground">Your Background (Optional)</Label>
          <Textarea
            id="userBackground"
            placeholder="Briefly describe your experience and skills for more tailored questions."
            value={userBackground}
            onChange={(e) => setUserBackground(e.target.value)}
            rows={4}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generate Interview Prep
        </Button>

        {prep && (
          <div className="space-y-2 pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Your Interview Prep
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
