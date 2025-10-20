"use client";

import { useEffect, useState } from "react";
import { AIFeatureTeaser } from "./ai-feature-teaser";
import { JobFitPreview } from "./previews/job-fit-preview";
import { ResumeAnalysisPreview } from "./previews/resume-analysis-preview";
import { InterviewPrepPreview } from "./previews/interview-prep-preview";
import { CoverLetterPreview } from "./previews/cover-letter-preview";

interface ApplicationListTeaserProps {
  applicationCount: number;
  className?: string;
}

const TEASER_VARIATIONS = [
  {
    feature: "Job Fit Analysis",
    preview: <JobFitPreview />,
    showAfter: 3,
  },
  {
    feature: "Resume Analysis",
    preview: <ResumeAnalysisPreview />,
    showAfter: 5,
  },
  {
    feature: "Interview Preparation",
    preview: <InterviewPrepPreview />,
    showAfter: 7,
  },
  {
    feature: "Cover Letter Generator",
    preview: <CoverLetterPreview />,
    showAfter: 10,
  },
];

export function ApplicationListTeaser({ 
  applicationCount, 
  className 
}: ApplicationListTeaserProps) {
  const [selectedTeaser, setSelectedTeaser] = useState<typeof TEASER_VARIATIONS[0] | null>(null);

  useEffect(() => {
    // Determine which teaser to show based on application count
    for (let i = TEASER_VARIATIONS.length - 1; i >= 0; i--) {
      if (applicationCount >= TEASER_VARIATIONS[i].showAfter) {
        setSelectedTeaser(TEASER_VARIATIONS[i]);
        break;
      }
    }
  }, [applicationCount]);

  if (!selectedTeaser || applicationCount < 3) {
    return null;
  }

  return (
    <div className={className}>
      <AIFeatureTeaser
        feature={selectedTeaser.feature}
        previewContent={selectedTeaser.preview}
        trackingId={`application-list-${applicationCount}`}
        className="max-w-md mx-auto"
      />
    </div>
  );
}