"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Sparkles,
  AlertCircle,
  Upload,
  FileText,
  Link,
  Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { generateResumeAdvice } from "@/lib/ai-coach/functions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";

interface ResumeAnalyzerProps {
  userId: string;
}

export function ResumeAnalyzer({ userId }: ResumeAnalyzerProps) {
  const { user, loading: authLoading } = useSupabaseAuth();
  const {
    createResumeAnalysis,
    loading: aiLoading,
    error,
    clearError,
  } = useAICoachClient(user?.id || null);
  const { getCurrentResume } = useResumesClient(user?.id || null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState<"text" | "url">("text");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = {
    ...COPY.aiCoach.resumeAnalyzer,
    description: `We'll use the resume you've already uploaded for analysis. If you'd like to analyze a different resume, you can upload a new one below. Uploading a new resume is optional.`,
  };
  const [resumeId, setResumeId] = useState("");
  const [userHasResume, setUserHasResume] = useState(false);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const [currentResumeText, setCurrentResumeText] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (authLoading) return; // Wait for auth to finish
    if (!user?.id) {
      setIsCheckingResume(false);
      return;
    }

    const checkUserResume = async () => {
      try {
        const resumeObj = await getCurrentResume();
        if (resumeObj) {
          setResumeId(resumeObj.id);
          setUserHasResume(true);
          setCurrentResumeText(resumeObj.extracted_text || "");
          // Do NOT set resumeText here; only set on upload
        } else {
          setUserHasResume(false);
          setCurrentResumeText("");
        }
      } catch (err) {
        console.error("Error checking user resume:", err);
        setUserHasResume(false);
        setCurrentResumeText("");
      } finally {
        setIsCheckingResume(false);
      }
    };

    checkUserResume();
  }, [authLoading, user?.id, getCurrentResume]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setLocalError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.FILE_TOO_LARGE);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      setLocalError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.INVALID_FILE_TYPE);
      return;
    }

    setUploadLoading(true);
    setLocalError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.RESUME_PROCESSING_FAILED
        );
      }

      setResumeText(data.text); // Only set on upload
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.RESUME_PROCESSING_FAILED
      );
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAnalyze = async () => {
    console.log("handleAnalyze");
    // Only send what the user has entered to the API
    const textToAnalyze = resumeText.trim();
    const urlToAnalyze =
      inputMethod === "url" && jobUrl.trim() ? jobUrl.trim() : undefined;
    const jobDescToAnalyze = jobDescription.trim();

    if (!textToAnalyze && !urlToAnalyze && !userHasResume) {
      setLocalError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_RESUME);
      return;
    }

    setLocalLoading(true);
    setLocalError("");
    setAnalysis("");
    clearError();

    try {
      // Call backend API route for analysis
      const response = await fetch("/api/ai-coach/analyze-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText: textToAnalyze || undefined,
          jobUrl: urlToAnalyze,
          jobDescription: jobDescToAnalyze || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLocalError(data.error || "Failed to analyze resume");
        return;
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to analyze resume"
      );
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = aiLoading || localLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            {copy.title}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-pointer ml-1" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>
                    We'll use your most recently uploaded resume for analysis.
                    Uploading a new resume is optional if you want to analyze a
                    different one.
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Resume Section */}
          {userHasResume && (
            <div className="mb-4 p-4 bg-background border border-green-200 rounded-lg">
              <div className="font-semibold mb-1">
                Current Resume Used for Analysis:
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-line max-h-32 overflow-auto border rounded p-2 bg-background">
                {currentResumeText || "No resume text found."}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-grow border-t border-muted-foreground/20" />
            <span className="mx-4 text-xs text-muted-foreground">
              Upload a Different Resume (Optional)
            </span>
            <div className="flex-grow border-t border-muted-foreground/20" />
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center bg-muted/10">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant={userHasResume ? "outline" : "default"}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
              className="w-full"
            >
              {uploadLoading ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  {copy.uploadButton.processing}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {copy.uploadButton.default}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {copy.uploadHint}
            </p>
          </div>

          {/* Manual Text Input */}
          <div className="space-y-2">
            <Label htmlFor="resume-text">{copy.pasteLabel}</Label>
            <Textarea
              id="resume-text"
              placeholder={copy.pastePlaceholder}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          {/* Job Description and URL Input (Tabbed) */}
          <div className="space-y-4 mt-8">
            <Label>
              {copy.jobDescriptionLabel}{" "}
              <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            <Tabs
              value={inputMethod}
              onValueChange={(value) => setInputMethod(value as "text" | "url")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">{copy.tabs.paste}</TabsTrigger>
                <TabsTrigger value="url">{copy.tabs.url}</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2">
                <Textarea
                  placeholder={copy.jobDescriptionPlaceholder}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </TabsContent>

              <TabsContent value="url" className="space-y-2">
                <Input
                  placeholder={copy.jdUrlPlaceholder}
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Error Display */}
          {(error || localError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || localError}</AlertDescription>
            </Alert>
          )}

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={
              isLoading ||
              (inputMethod === "url"
                ? !(jobUrl.trim() || resumeText.trim() || userHasResume)
                : !(resumeText.trim() || userHasResume))
            }
            className="w-full bg-purple-600 hover:bg-purple-700 mt-6"
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Resume...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                {copy.analyzeButton}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <MarkdownOutputCard
          title={copy.analysisTitle}
          icon={<FileText className="h-5 w-5 text-purple-600" />}
          content={analysis}
        />
      )}
    </div>
  );
}
