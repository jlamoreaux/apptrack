"use client";

import { FileText } from "lucide-react";
import { PreviewBlurOverlay } from "./preview-blur-overlay";

interface CoverLetterResultsProps {
  coverLetter: string;
  isPreview?: boolean;
  companyName?: string;
  roleName?: string;
}

export function CoverLetterResults({
  coverLetter,
  isPreview = false,
  companyName,
  roleName,
}: CoverLetterResultsProps) {
  const previewLength = 300;
  const displayText = isPreview && coverLetter.length > previewLength
    ? coverLetter.substring(0, previewLength) + "..."
    : coverLetter;

  const CoverLetterContent = () => (
    <div className="whitespace-pre-wrap font-serif text-base leading-relaxed p-6 bg-card border rounded-lg">
      {displayText}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
          <FileText className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">
            {isPreview ? "Cover Letter Preview" : "Your Cover Letter"}
          </h3>
          {(companyName || roleName) && (
            <p className="text-sm text-muted-foreground">
              {roleName ? `${roleName} at ` : ""}
              {companyName || "Company"}
            </p>
          )}
        </div>
      </div>

      {isPreview ? (
        <PreviewBlurOverlay
          title="Sign up to unlock full cover letter"
          description="See the complete professionally-written cover letter tailored to your experience"
        >
          <CoverLetterContent />
        </PreviewBlurOverlay>
      ) : (
        <>
          <CoverLetterContent />
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg text-sm">
            <div>
              <span className="text-muted-foreground">Word count:</span>
              <span className="ml-2 font-medium">
                {coverLetter.split(/\s+/).filter(Boolean).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Character count:</span>
              <span className="ml-2 font-medium">{coverLetter.length}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
