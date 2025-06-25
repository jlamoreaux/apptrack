"use client";

import type React from "react";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";

interface ResumeAnalyzerProps {
  userId: string;
}

export function ResumeAnalyzer({ userId }: ResumeAnalyzerProps) {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "url">("text");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = COPY.aiCoach.resumeAnalyzer;

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.FILE_TOO_LARGE);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.INVALID_FILE_TYPE);
      return;
    }

    setUploadLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(API_ROUTES.AI_COACH.UPLOAD_RESUME, {
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
    } catch (err) {
      setError(
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
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_URL);
      return;
    }

    setUrlLoading(true);
    setError("");

    try {
      const response = await fetch(API_ROUTES.AI_COACH.FETCH_JOB_DESCRIPTION, {
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
      setError(
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
      setError(ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_RESUME);
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis("");

    try {
      const response = await fetch(API_ROUTES.AI_COACH.ANALYZE_RESUME, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText: resumeText.trim(),
          jobDescription: jobDescription.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.ANALYSIS_FAILED
        );
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED);
    } finally {
      setLoading(false);
    }
  };

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
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadLoading}
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
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {copy.uploadHint}
                  </p>
                </div>
              </div>

              {/* Text Input */}
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
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {copy.tabs.paste}
                </TabsTrigger>
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  {copy.tabs.url}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2">
                <Textarea
                  placeholder={copy.jobDescriptionPlaceholder}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[120px]"
                />
              </TabsContent>

              <TabsContent value="url" className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={copy.jdUrlPlaceholder}
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                  />
                  <Button
                    onClick={handleUrlFetch}
                    disabled={urlLoading || !jobUrl.trim()}
                    variant="outline"
                  >
                    {urlLoading ? (
                      <Sparkles className="h-4 w-4 animate-spin" />
                    ) : (
                      copy.fetchButton
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter a job posting URL to automatically extract the
                  description
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={loading || !resumeText.trim()}
            className="w-full"
          >
            {loading ? (
              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Brain className="h-4 w-4 mr-2" />
            )}
            {loading ? "Analyzing..." : copy.analyzeButton}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
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
