import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload } from "lucide-react";

interface ResumePreviewUploadProps {
  userHasResume: boolean;
  resumeText: string;
  onUpload: (file: File) => void;
  loading: boolean;
  error?: string;
}

export const ResumePreviewUpload: React.FC<ResumePreviewUploadProps> = ({
  userHasResume,
  resumeText,
  onUpload,
  loading,
  error,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4">
      {userHasResume ? (
        <div className="mb-4 p-4 bg-background border border-green-200 rounded-lg">
          <div className="font-semibold mb-1">
            Current Resume Used for Analysis:
          </div>
          <div className="prose prose-sm dark:prose-invert text-xs text-muted-foreground whitespace-pre-line max-h-32 overflow-auto border rounded p-2 bg-background">
            {resumeText || "No resume text found."}
          </div>
        </div>
      ) : (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-900">
          <div className="font-semibold mb-1">No resume found</div>
          <div>Please upload your resume to get started.</div>
        </div>
      )}
      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center bg-muted/10">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
          className="hidden"
        />
        <Button
          variant={userHasResume ? "outline" : "default"}
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Resume
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          PDF, Word, or text files up to 5MB
        </p>
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
      </div>
    </div>
  );
};
