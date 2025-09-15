"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { JobDescriptionInput } from "./JobDescriptionInput";
import { Separator } from "@/components/ui/separator";

interface ResumeAndJobInputProps {
  jobDescription: string;
  setJobDescription: (value: string) => void;
  resumeText?: string;
  setResumeText?: (value: string) => void;
  onApplicationSelect?: (appId: string, company?: string, role?: string) => void;
  jobDescriptionLabel?: string;
  jobDescriptionOptional?: boolean;
  allowResumeUpload?: boolean;
  onResumeUpload?: (file: File) => Promise<void>;
}

export function ResumeAndJobInput({
  jobDescription,
  setJobDescription,
  resumeText,
  setResumeText,
  onApplicationSelect,
  jobDescriptionLabel = "Job Description",
  jobDescriptionOptional = true,
  allowResumeUpload = true,
  onResumeUpload,
}: ResumeAndJobInputProps) {
  const { user } = useSupabaseAuth();
  const { getCurrentResume } = useResumesClient(user?.id || null);
  const [userHasResume, setUserHasResume] = useState(false);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const [currentResumeInfo, setCurrentResumeInfo] = useState<{
    name?: string;
    length?: number;
  }>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check for existing resume on mount
  useEffect(() => {
    const checkUserResume = async () => {
      if (!user?.id) {
        setIsCheckingResume(false);
        return;
      }

      try {
        const resumeObj = await getCurrentResume();
        if (resumeObj) {
          setUserHasResume(true);
          setCurrentResumeInfo({
            name: resumeObj.file_type ? `Resume.${resumeObj.file_type.split('/').pop()}` : "Current Resume",
            length: resumeObj.extracted_text?.length || 0,
          });
          // Don't set resumeText by default - only when explicitly uploading
        } else {
          setUserHasResume(false);
        }
      } catch (err) {
        console.error("Error checking user resume:", err);
        setUserHasResume(false);
      } finally {
        setIsCheckingResume(false);
      }
    };

    checkUserResume();
  }, [user?.id, getCurrentResume]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    try {
      if (onResumeUpload) {
        await onResumeUpload(file);
      }
      // If setResumeText is provided, read the file
      if (setResumeText && file.type === "text/plain") {
        const text = await file.text();
        setResumeText(text);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
    }
  };

  if (isCheckingResume) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-2">
          <Upload className="h-8 w-8 animate-pulse mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resume Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Resume</Label>
          {userHasResume && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Ready for analysis
            </div>
          )}
        </div>

        {userHasResume ? (
          <Alert className="border-green-600">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentResumeInfo.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentResumeInfo.length ? `${currentResumeInfo.length.toLocaleString()} characters` : "Resume loaded"}
                  </p>
                </div>
                {allowResumeUpload && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-4"
                    onClick={() => document.getElementById("resume-upload")?.click()}
                    disabled={isUploading}
                  >
                    Replace Resume
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No resume found. Please upload your resume to continue.
            </AlertDescription>
          </Alert>
        )}

        {/* Upload/Paste Options - Only show if no resume exists */}
        {!userHasResume && (
          <div className="space-y-4">
            {allowResumeUpload && (
              <>
                <div className="relative">
                  <input
                    id="resume-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById("resume-upload")?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadedFile ? uploadedFile.name : "Upload Resume (Optional)"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    PDF, Word, or text files up to 5MB
                  </p>
                </div>

                {setResumeText && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or paste your resume
                        </span>
                      </div>
                    </div>

                    <Textarea
                      placeholder="Paste your resume text here..."
                      value={resumeText || ""}
                      onChange={(e) => setResumeText(e.target.value)}
                      className="min-h-[150px] font-mono text-sm"
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Job Description Section */}
      <div className="space-y-4">
        <JobDescriptionInput
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          label={`${jobDescriptionLabel} ${jobDescriptionOptional ? "(Optional)" : ""}`}
          placeholder="Paste the job description for targeted analysis..."
          onApplicationSelect={onApplicationSelect}
        />
      </div>
    </div>
  );
}