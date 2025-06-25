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
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { generateResumeAdvice } from "@/lib/ai-coach/functions";
import { ResumeUpload } from "@/components/resume-upload";

interface ResumeAnalyzerProps {
  userId: string;
}

export function ResumeAnalyzer({ userId }: ResumeAnalyzerProps) {
  const { user } = useSupabaseAuth();
  const { createResumeAnalysis, loading, error, clearError } = useAICoachClient(
    user?.id || null
  );
  const {
    hasResume,
    getResumeText,
    loading: resumeLoading,
  } = useResumesClient(user?.id || null);

  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "url">("text");
  const [userHasResume, setUserHasResume] = useState<boolean | null>(null);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = COPY.aiCoach.resumeAnalyzer;

  // Check if user has a resume on component mount
  useEffect(() => {
    const checkUserResume = async () => {
      if (!user?.id) return;

      try {
        const hasResumeResult = await hasResume();
        setUserHasResume(hasResumeResult);

        if (hasResumeResult) {
          // Load the resume text automatically
          const resumeTextResult = await getResumeText();
          if (resumeTextResult) {
            setResumeText(resumeTextResult);
          }
        }
      } catch (err) {
        console.error("Error checking user resume:", err);
        setUserHasResume(false);
      } finally {
        setIsCheckingResume(false);
      }
    };

    checkUserResume();
  }, [user?.id, hasResume, getResumeText]);

  const handleResumeUploadSuccess = async (resume: any) => {
    setUserHasResume(true);
    if (resume.extracted_text) {
      setResumeText(resume.extracted_text);
    }
  };

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

      setResumeText(data.text);
      setUserHasResume(true);
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

  const handleUrlFetch = async () => {
    if (!jobUrl.trim()) {
      setLocalError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_URL);
      return;
    }

    setUrlLoading(true);
    setLocalError("");

    try {
      const response = await fetch("/api/ai-coach/fetch-job-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: jobUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.URL_FETCH_FAILED
        );
      }

      setJobDescription(data.description);
      setInputMethod("text"); // Switch to text view to show the fetched content
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.URL_FETCH_FAILED
      );
    } finally {
      setUrlLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      setLocalError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_RESUME);
      return;
    }

    setLocalLoading(true);
    setLocalError("");
    setAnalysis("");
    clearError();

    try {
      // Generate resume analysis using AI
      const generatedAnalysis = await generateResumeAdvice(
        resumeText.trim(),
        jobDescription.trim() || undefined
      );

      const result = await createResumeAnalysis(
        "placeholder-url",
        generatedAnalysis
      );

      if (result) {
        setAnalysis(result.analysis_result);
      } else {
        setAnalysis(generatedAnalysis);
      }
    } catch (err) {
      // Error is handled by the hook
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = loading || localLoading || isCheckingResume;

  // Show loading state while checking for resume
  if (isCheckingResume) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center py-8">
              <Sparkles className="h-6 w-6 mr-2 animate-spin" />
              <span>Loading your resume...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show resume upload prompt if user doesn't have a resume
  if (userHasResume === false) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {copy.title}
            </CardTitle>
            <CardDescription>
              Upload your resume to get started with AI-powered analysis and
              feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResumeUpload
              onUploadSuccess={handleResumeUploadSuccess}
              onUploadError={(error) => setLocalError(error)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show analysis interface if user has a resume
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            {copy.title}
          </CardTitle>
          <CardDescription>
            {copy.description}
            {resumeLoading && " Loading your resume..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resume Status */}
          {userHasResume && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-800">
                Resume loaded successfully. You can analyze it below or upload a
                new one.
              </span>
            </div>
          )}

          {/* Resume Input */}
          <div className="space-y-4">
            <Label>{copy.resumeLabel}</Label>
            <div className="space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLoading}
                  className="w-full"
                >
                  {uploadLoading ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New Resume (PDF, DOC, DOCX, TXT)
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Max 5MB. Supports PDF, Word, and text files.
                </p>
              </div>

              {/* Manual Text Input */}
              <div className="space-y-2">
                <Label htmlFor="resume-text">Or paste your resume text</Label>
                <Textarea
                  id="resume-text"
                  placeholder="Paste your resume content here..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
            </div>
          </div>

          {/* Job Description Input */}
          <div className="space-y-4">
            <Label>{copy.jobDescriptionLabel}</Label>
            <Tabs
              value={inputMethod}
              onValueChange={(value) => setInputMethod(value as "text" | "url")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Paste Text</TabsTrigger>
                <TabsTrigger value="url">Fetch from URL</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2">
                <Textarea
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[150px]"
                />
              </TabsContent>

              <TabsContent value="url" className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://company.com/careers/job-id"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                  />
                  <Button
                    onClick={handleUrlFetch}
                    disabled={urlLoading || !jobUrl.trim()}
                    className="whitespace-nowrap"
                  >
                    {urlLoading ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4 mr-2" />
                        Fetch
                      </>
                    )}
                  </Button>
                </div>
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
            disabled={isLoading || !resumeText.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Resume...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Analyze Resume
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              {copy.analysisTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {analysis}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
