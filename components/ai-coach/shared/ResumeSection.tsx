import React, { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface ResumeSectionProps {
  userHasResume: boolean;
  currentResumeText: string;
  onResumeTextChange: (text: string) => void;
  resumeText: string;
}

export const ResumeSection: React.FC<ResumeSectionProps> = ({
  userHasResume,
  currentResumeText,
  onResumeTextChange,
  resumeText,
}) => {
  const { user } = useSupabaseAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB");
      return;
    }

    setUploadLoading(true);
    setUploadError("");

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload to the API endpoint
      const response = await fetch("/api/ai-coach/upload-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload resume");
      }

      const data = await response.json();
      
      // Update the resume text with the extracted content
      if (data.extractedText) {
        onResumeTextChange(data.extractedText);
      } else {
        throw new Error("No text extracted from resume");
      }
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setUploadError(error.message || "Failed to process file");
    } finally {
      setUploadLoading(false);
    }
  };

  const effectiveResumeText = resumeText || currentResumeText;
  const hasResume = !!effectiveResumeText;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resume
        </CardTitle>
        <CardDescription>
          {hasResume
            ? "Your resume is ready for cover letter generation"
            : "Upload your resume to generate a personalized cover letter"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resume Preview */}
        {hasResume ? (
          <div className="space-y-3">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-medium">Current Resume</div>
                {resumeText && (
                  <span className="text-xs text-muted-foreground bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                    Newly uploaded
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {effectiveResumeText.substring(0, 300)}...
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {effectiveResumeText.length} characters loaded
              </div>
            </div>
            
            {!resumeText && currentResumeText && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Using your previously uploaded resume. Upload a new one to replace it.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No resume found. Please upload your resume to continue.
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Section */}
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploadLoading}
          />
          <div className="text-center space-y-2">
            <Button
              variant={hasResume ? "outline" : "default"}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadLoading ? "Processing..." : hasResume ? "Replace Resume" : "Upload Resume"}
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, Word, or text files up to 5MB
            </p>
          </div>
        </div>

        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};