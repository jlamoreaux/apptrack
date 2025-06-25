"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { isSupportedFileType } from "@/lib/utils/text-extraction";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface ResumeUploadProps {
  onUploadSuccess?: (resume: any) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

export function ResumeUpload({
  onUploadSuccess,
  onUploadError,
  className,
}: ResumeUploadProps) {
  const { user } = useSupabaseAuth();
  const {
    createResume,
    loading: dalLoading,
    error: dalError,
    clearError,
  } = useResumesClient(user?.id || null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    []
  );

  const handleFileUpload = async (file: File) => {
    setError(null);
    setSuccess(null);
    clearError();
    setIsUploading(true);
    setUploadProgress(0);

    // Validate file type
    if (!isSupportedFileType(file.type)) {
      setError("Please upload a PDF, Word document (.doc/.docx), or text file");
      setIsUploading(false);
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      setIsUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();

      // Save to database using DAL
      if (user?.id) {
        await createResume({
          user_id: user.id,
          file_url: data.resume.file_url,
          file_type: data.resume.file_type,
          extracted_text: data.resume.extracted_text,
        });
      }

      setSuccess("Resume uploaded successfully!");
      onUploadSuccess?.(data.resume);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const isLoading = isUploading || dalLoading;
  const displayError = error || dalError;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resume Upload
        </CardTitle>
        <CardDescription>
          Upload your resume to enable AI features. Supports PDF, Word
          documents, and text files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            {isLoading ? "Uploading..." : "Drop your resume here"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse files
          </p>
          <Button
            variant="outline"
            onClick={() =>
              document.getElementById("resume-file-input")?.click()
            }
            disabled={isLoading}
          >
            Choose File
          </Button>
          <input
            id="resume-file-input"
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>Supported formats: PDF, DOC, DOCX, TXT</p>
          <p>Maximum file size: 5MB</p>
        </div>
      </CardContent>
    </Card>
  );
}
