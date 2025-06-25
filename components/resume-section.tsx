"use client";

import { useState, useEffect } from "react";
import { ResumeUpload } from "./resume-upload";
import { ResumeManagement } from "./resume-management";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface Resume {
  id: string;
  file_url: string;
  file_type: string;
  extracted_text: string;
  uploaded_at: string;
  updated_at: string;
}

interface ResumeSectionProps {
  className?: string;
}

export function ResumeSection({ className }: ResumeSectionProps) {
  const { user } = useSupabaseAuth();
  const { hasResume, loading, error } = useResumesClient(user?.id || null);
  const [hasResumeState, setHasResumeState] = useState<boolean | null>(null);

  useEffect(() => {
    const checkResume = async () => {
      if (user?.id) {
        const hasResumeResult = await hasResume();
        setHasResumeState(hasResumeResult);
      }
    };

    checkResume();
  }, [user?.id, hasResume]);

  const handleUploadSuccess = (resume: Resume) => {
    setHasResumeState(true);
  };

  const handleResumeDeleted = () => {
    setHasResumeState(false);
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center p-8">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {hasResumeState ? (
        <ResumeManagement
          onResumeDeleted={handleResumeDeleted}
          onResumeUpdated={() => {}}
        />
      ) : (
        <ResumeUpload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={() => {}}
        />
      )}
    </div>
  );
}
