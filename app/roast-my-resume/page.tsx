"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Loader2, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRoastAnalytics, ROAST_EVENTS } from "@/lib/roast/analytics";
import { RoastingAnimationLazy } from "@/components/roast/roasting-animation-lazy";

export default function RoastMyResumePage() {
  const router = useRouter();
  const { trackEvent } = useRoastAnalytics();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
  };

  const validateFile = (file: File) => {
    // Check file extension as well as MIME type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'doc', 'docx'];
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension || '')) {
      return { valid: false, error: "Please upload a PDF, DOC, or DOCX file" };
    }
    
    return { valid: true };
  };


  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a resume file");
      return;
    }

    setIsUploading(true);
    setError(null);
    trackEvent(ROAST_EVENTS.UPLOAD_STARTED, { fileType: file.type, fileSize: file.size });

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/api/roast", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.requiresAuth) {
          trackEvent(ROAST_EVENTS.LIMIT_REACHED);
        }
        throw new Error(data.error || "Failed to roast resume");
      }

      const { roastId } = await response.json();
      trackEvent(ROAST_EVENTS.UPLOAD_COMPLETED, { roastId });
      router.push(`/roast/${roastId}`);
    } catch (err) {
      trackEvent(ROAST_EVENTS.UPLOAD_FAILED, { error: err instanceof Error ? err.message : "Unknown error" });
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsUploading(false);
    }
  };

  return (
    <>
      {isUploading && <RoastingAnimationLazy />}
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flame className="h-10 w-10 text-red-500" />
            <h1 className="text-4xl sm:text-5xl font-bold text-primary">
              Roast My Resume
            </h1>
            <Flame className="h-10 w-10 text-red-500" />
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
            Get brutally honest feedback on your resume
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sugarcoating. Just the truth you need to hear.
          </p>
        </div>

        {/* Upload Card */}
        <Card className="p-8 shadow-xl">
          <FileUpload
            onFileSelect={handleFileSelect}
            accept=".pdf,.doc,.docx"
            maxSize={5 * 1024 * 1024}
            buttonText="Select Resume"
            dragText="Drop your resume here"
            isUploading={isUploading}
            error={error}
            selectedFile={file}
            validateFile={validateFile}
            supportedFormats={["PDF", "DOC", "DOCX"]}
          />

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!file || isUploading}
            className="w-full mt-6"
            size="lg"
          >
            <Flame className="mr-2 h-4 w-4 text-red-500" />
            Roast This Resume
          </Button>
        </Card>

        {/* Privacy Notice */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <p className="text-sm text-center text-gray-600 dark:text-gray-300">
            <span className="font-semibold">🔒 Privacy First:</span> We automatically remove personal information
            (except first names) before generating your roast. We never store your actual resume - only the anonymized roast expires after 30 days.
          </p>
        </div>

        {/* Footer Links */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Already roasted?{" "}
            <Link
              href="/signup"
              className="text-primary hover:text-primary/90 font-medium"
            >
              Sign up for unlimited roasts
            </Link>
          </p>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Back to AppTrack
          </Link>
        </div>
        </div>
      </div>
    </>
  );
}