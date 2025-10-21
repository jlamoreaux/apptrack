"use client";

import { FileText, Lock } from "lucide-react";

interface CoverLetterResultsProps {
  coverLetter: string;
  isPreview?: boolean;
  companyName?: string;
  roleName?: string;
}

/**
 * Display cover letter results
 * Shows partial content in preview mode (before signup)
 * Shows full content after signup
 */
export function CoverLetterResults({
  coverLetter,
  isPreview = false,
  companyName,
  roleName,
}: CoverLetterResultsProps) {
  // In preview mode, show only first ~300 characters
  const previewLength = 300;
  const displayText = isPreview && coverLetter.length > previewLength
    ? coverLetter.substring(0, previewLength) + "..."
    : coverLetter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-indigo-100 rounded-lg">
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

      {/* Cover Letter Content */}
      <div className="relative">
        <div
          className={`prose prose-sm max-w-none ${
            isPreview ? "filter blur-sm select-none" : ""
          }`}
        >
          <div className="whitespace-pre-wrap font-serif text-base leading-relaxed p-6 bg-white border rounded-lg">
            {displayText}
          </div>
        </div>

        {/* Unlock Overlay (Preview Mode) */}
        {isPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-white via-white/95 to-white/50">
            <div className="text-center max-w-md p-6">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                  <Lock className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
              <h4 className="text-xl font-semibold mb-2">
                Sign up to unlock full cover letter
              </h4>
              <p className="text-sm text-muted-foreground">
                See the complete professionally-written cover letter tailored to your experience
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats / Info */}
      {!isPreview && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg text-sm">
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
      )}
    </div>
  );
}
