"use client";

import { useEffect } from "react";
import { FileText, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UserResume } from "@/types";
import { useAICoachData } from "@/contexts/ai-coach-data-context";

interface ResumeSelectorProps {
  userId: string;
  selectedResumeId?: string | null;
  onSelect: (resumeId: string | null) => void;
  className?: string;
  placeholder?: string;
  allowDefault?: boolean; // Allow "Use Default" option
}

export function ResumeSelector({
  userId,
  selectedResumeId,
  onSelect,
  className,
  placeholder = "Select resume...",
  allowDefault = true,
}: ResumeSelectorProps) {
  const { data, loading, fetchResumes } = useAICoachData();
  const resumes = data.resumes as UserResume[];

  useEffect(() => {
    if (userId) {
      fetchResumes();
    }
  }, [userId, fetchResumes]);

  const defaultResume = resumes.find((r) => r.is_default);

  if (loading.resumes) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <FileText className="h-4 w-4" />
        Loading resumes...
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <FileText className="h-4 w-4" />
        No resumes uploaded
      </div>
    );
  }

  return (
    <Select
      value={selectedResumeId || "default"}
      onValueChange={(value) => {
        onSelect(value === "default" ? null : value);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowDefault && (
          <SelectItem value="default">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>
                Use Default{" "}
                {defaultResume && (
                  <span className="text-muted-foreground">
                    ({defaultResume.name})
                  </span>
                )}
              </span>
            </div>
          </SelectItem>
        )}
        {resumes.map((resume) => (
          <SelectItem key={resume.id} value={resume.id}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span>{resume.name}</span>
                  {resume.is_default && (
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  )}
                </div>
                {resume.description && (
                  <span className="text-xs text-muted-foreground">
                    {resume.description}
                  </span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
