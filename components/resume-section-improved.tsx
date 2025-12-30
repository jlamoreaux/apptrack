"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Upload, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useAICoachData } from "@/contexts/ai-coach-data-context";
import { useToast } from "@/hooks/use-toast";
import { ResumeUploadDialog } from "./resume-management/ResumeUploadDialog";
import { ResumeEditDialog } from "./resume-management/ResumeEditDialog";
import { ResumeLimitIndicator } from "./resume-management/ResumeLimitIndicator";
import type { UserResume } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface ResumeSectionImprovedProps {
  className?: string;
}

export function ResumeSectionImproved({ className }: ResumeSectionImprovedProps) {
  const { user } = useSupabaseAuth();
  const { invalidateCache } = useAICoachData();
  const { toast } = useToast();
  const [resumes, setResumes] = useState<UserResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingResume, setEditingResume] = useState<UserResume | null>(null);
  const [meta, setMeta] = useState<{
    total: number;
    limit: number;
    canAdd: boolean;
    plan: string;
  } | null>(null);

  const fetchResumes = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await fetch("/api/resume/list");
      if (response.ok) {
        const data = await response.json();
        setResumes(data.resumes || []);
        setMeta(data.meta);
      }
    } catch (error) {
      console.error("Failed to fetch resumes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, [user?.id]);

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    // Invalidate context cache so ResumeSelector components refresh
    invalidateCache('resumes');
    invalidateCache('resume'); // Also invalidate current resume cache
    fetchResumes();
  };

  const handleEditSuccess = () => {
    setEditingResume(null);
    // Invalidate context cache so ResumeSelector components refresh
    invalidateCache('resumes');
    invalidateCache('resume');
    fetchResumes();
  };

  const handleDeleteSuccess = () => {
    setEditingResume(null);
    // Invalidate context cache so ResumeSelector components refresh
    invalidateCache('resumes');
    invalidateCache('resume');
    fetchResumes();
    toast({
      title: "Resume deleted",
      description: "Your resume has been deleted successfully",
    });
  };

  const defaultResume = resumes.find((r) => r.is_default);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading resumes...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No resumes - show upload prompt
  if (resumes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Your Resume
          </CardTitle>
          <CardDescription>
            Upload your resume to unlock AI-powered career tools
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4 text-center">
              No resumes uploaded yet
            </p>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Your First Resume
            </Button>
          </div>

          <ResumeUploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onUploadSuccess={handleUploadSuccess}
          />
        </CardContent>
      </Card>
    );
  }

  // Has resumes - show list with prominent display
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Resumes
            </CardTitle>
            <CardDescription>
              {defaultResume
                ? `Using "${defaultResume.name}" as your default resume`
                : "Select a default resume for AI features"}
            </CardDescription>
          </div>
          <Button
            onClick={() => setUploadDialogOpen(true)}
            size="sm"
            disabled={!meta?.canAdd}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Resume
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Limit indicator */}
        {meta && (
          <ResumeLimitIndicator
            current={meta.total}
            limit={meta.limit}
            plan={meta.plan}
          />
        )}

        {/* Resume list - showing up to 3, with link to full management */}
        <div className="space-y-3">
          {resumes.slice(0, 3).map((resume) => (
            <div
              key={resume.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{resume.name}</p>
                    {resume.is_default && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </Badge>
                    )}
                  </div>
                  {resume.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {resume.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Uploaded{" "}
                    {formatDistanceToNow(new Date(resume.uploaded_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingResume(resume)}
              >
                View
              </Button>
            </div>
          ))}
        </div>

        {/* Show "view all" link if more than 3 resumes */}
        {resumes.length > 3 && (
          <div className="text-center pt-2">
            <Button
              variant="link"
              onClick={() => (window.location.href = "/dashboard/resumes")}
            >
              View all {resumes.length} resumes
            </Button>
          </div>
        )}

        {/* Upload dialog */}
        <ResumeUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* Edit dialog */}
        {editingResume && (
          <ResumeEditDialog
            resume={editingResume}
            open={!!editingResume}
            onOpenChange={(open) => !open && setEditingResume(null)}
            onEditSuccess={handleEditSuccess}
            onDeleteSuccess={handleDeleteSuccess}
          />
        )}
      </CardContent>
    </Card>
  );
}
