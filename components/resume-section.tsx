"use client";

import { useState, useEffect } from "react";
import { ResumeUpload } from "./resume-upload";
import { ResumeManagement } from "./resume-management";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useAICoachData } from "@/contexts/ai-coach-data-context";

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
  const { hasResume, loading: clientLoading, error } = useResumesClient(user?.id || null);
  const { data, loading: cacheLoading, fetchResume, invalidateCache } = useAICoachData();
  const [hasResumeState, setHasResumeState] = useState<boolean | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    // Only check once on mount or when user changes
    if (!user?.id || initialLoadComplete) return;

    const checkResume = async () => {
      // Always try to fetch the resume to get the current state
      try {
        const text = await fetchResume();
        setHasResumeState(!!text);
      } catch (error) {
        // If fetch fails, assume no resume
        setHasResumeState(false);
      } finally {
        setInitialLoadComplete(true);
      }
    };

    checkResume();
  }, [user?.id, fetchResume, initialLoadComplete]);

  const handleUploadSuccess = async (resume: Resume) => {
    setHasResumeState(true);
    // Invalidate and refresh cached data
    invalidateCache('resume');
    await fetchResume(true);
  };

  const handleResumeDeleted = async () => {
    setHasResumeState(false);
    // Invalidate cache
    invalidateCache('resume');
  };

  // Show loading only on initial load
  if (!initialLoadComplete) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Checking resume status...</div>
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
