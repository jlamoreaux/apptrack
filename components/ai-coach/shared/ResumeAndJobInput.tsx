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
import { useAICoachData } from "@/contexts/ai-coach-data-context";
import { useToast } from "@/hooks/use-toast";

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
  const { data: cachedData, loading: cacheLoading, invalidateCache, fetchResume } = useAICoachData();
  const { toast } = useToast();
  const [userHasResume, setUserHasResume] = useState(false);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const [currentResumeInfo, setCurrentResumeInfo] = useState<{
    name?: string;
    length?: number;
    uploadedAt?: Date;
    isNewUpload?: boolean;
  }>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Use cached resume data instead of fetching again
  useEffect(() => {
    if (!user?.id) {
      setIsCheckingResume(false);
      return;
    }

    // Prefer passed resumeText prop over cached data
    const effectiveResumeText = resumeText || cachedData.resumeText;
    
    // Check cache status once
    if (!cacheLoading.resume) {
      if (effectiveResumeText) {
        setUserHasResume(true);
        setCurrentResumeInfo({
          name: cachedData.resumeInfo?.fileName || "Resume",
          length: effectiveResumeText.length || 0,
          uploadedAt: cachedData.resumeInfo?.uploadedAt ? new Date(cachedData.resumeInfo.uploadedAt) : undefined,
          isNewUpload: false,
        });
        // Update parent component's resumeText if it's empty but we have cached data
        if (!resumeText && cachedData.resumeText && setResumeText) {
          setResumeText(cachedData.resumeText);
        }
      } else {
        setUserHasResume(false);
      }
      setIsCheckingResume(false);
    }
  }, [user?.id, resumeText, cachedData.resumeText, cacheLoading.resume, setResumeText]);

  // Update resume info when cached data changes (e.g., after upload)
  useEffect(() => {
    if (cachedData.resumeInfo && userHasResume) {
      // Only update if we have new data from the server
      const newFileName = cachedData.resumeInfo.fileName;
      const newLength = cachedData.resumeText?.length || 0;
      
      // Update with latest server data if it's different
      if (newFileName && (newFileName !== currentResumeInfo.name || newLength !== currentResumeInfo.length)) {
        setCurrentResumeInfo(prev => ({
          ...prev,
          name: newFileName,
          length: newLength,
          uploadedAt: cachedData.resumeInfo.uploadedAt ? new Date(cachedData.resumeInfo.uploadedAt) : prev.uploadedAt,
        }));
      }
    }
  }, [cachedData.resumeInfo, cachedData.resumeText, userHasResume]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive",
      });
      e.target.value = ''; // Reset input
      return;
    }

    setUploadedFile(file);
    setIsUploading(true);

    try {
      if (onResumeUpload) {
        await onResumeUpload(file);
        toast({
          title: "Resume uploaded successfully",
          description: "Your resume has been processed and saved",
        });
        // Immediately show the uploaded file info
        setUserHasResume(true);
        setCurrentResumeInfo({
          name: file.name,
          length: file.size,
          uploadedAt: new Date(),
          isNewUpload: true,
        });
        
        // Force refresh the cached data to get the latest from server
        invalidateCache?.('resume');
        
        // Fetch fresh data after a short delay to ensure DB is updated
        setTimeout(async () => {
          await fetchResume?.(true);
        }, 1000);
      }
      // If setResumeText is provided, read the file for text files
      if (setResumeText && file.type === "text/plain") {
        const text = await file.text();
        setResumeText(text);
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process your resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
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
                  <p className="font-medium">
                    {currentResumeInfo.name || "Current Resume"}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {currentResumeInfo.length ? `${currentResumeInfo.length.toLocaleString()} characters` : "Resume loaded"}
                    </p>
                    {currentResumeInfo.isNewUpload && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded">
                        Just uploaded
                      </span>
                    )}
                  </div>
                </div>
                {allowResumeUpload && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-4"
                    onClick={() => document.getElementById("resume-upload")?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Upload className="mr-2 h-3 w-3 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Replace Resume"
                    )}
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

        {/* Hidden file input - always rendered for Replace Resume button */}
        {allowResumeUpload && (
          <input
            id="resume-upload"
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        )}

        {/* Upload/Paste Options - Only show if no resume exists */}
        {!userHasResume && (
          <div className="space-y-4">
            {allowResumeUpload && (
              <>
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById("resume-upload")?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-spin" />
                        Processing resume...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadedFile ? uploadedFile.name : "Upload Resume (Optional)"}
                      </>
                    )}
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