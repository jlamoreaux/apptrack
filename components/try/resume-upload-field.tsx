"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { useResumeUpload } from "@/lib/hooks/use-resume-upload";

interface ResumeUploadFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  minLength?: number;
}

export function ResumeUploadField({
  value,
  onChange,
  error,
  disabled = false,
  label = "Your Background",
  placeholder = `Paste your resume or write a brief summary of your experience...

Example:
I'm a software engineer with 4 years of experience building web applications. I've worked extensively with React, TypeScript, and Node.js at two startups.

Skills: JavaScript, React, TypeScript, Node.js, PostgreSQL, AWS`,
  minLength = 50,
}: ResumeUploadFieldProps) {
  const {
    uploadedFile,
    isUploading,
    error: uploadError,
    fileInputRef,
    handleFileSelect,
    clearFile,
    triggerFileSelect,
  } = useResumeUpload({
    onSuccess: (text) => onChange(text),
  });

  const handleClearFile = () => {
    clearFile();
    onChange("");
  };

  const handleTextChange = (newValue: string) => {
    onChange(newValue);
    if (uploadedFile) {
      clearFile();
    }
  };

  const isDisabled = disabled || isUploading;

  return (
    <div className="space-y-2">
      <Label htmlFor="userBackground" className="text-base font-medium">
        👤 {label} <span className="text-destructive">*</span>
      </Label>

      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isDisabled}
        />
        {uploadedFile ? (
          <div className="flex items-center gap-2 flex-1">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium truncate">{uploadedFile.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFile}
              disabled={isDisabled}
              className="ml-auto h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerFileSelect}
              disabled={isDisabled}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isUploading ? "Processing..." : "Upload Resume"}
            </Button>
            <span className="text-sm text-muted-foreground">PDF, Word, or text file</span>
          </>
        )}
      </div>
      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or paste your resume</span>
        </div>
      </div>

      <Textarea
        id="userBackground"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        rows={6}
        className={error ? "border-destructive" : ""}
        disabled={isDisabled}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {value.length} characters (minimum {minLength})
      </p>
    </div>
  );
}
