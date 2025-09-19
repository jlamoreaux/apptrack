"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getFileTypeLabel } from "@/lib/utils/text-extraction";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { FileInfo } from "@/components/ui/file-info";
import type { UserResume } from "@/types";

interface ResumeManagementProps {
  onResumeDeleted?: () => void;
  onResumeUpdated?: (resume: UserResume) => void;
  className?: string;
}

export function ResumeManagement({
  onResumeDeleted,
  onResumeUpdated,
  className,
}: ResumeManagementProps) {
  const { user } = useSupabaseAuth();
  const { getCurrentResume, deleteResume, loading, error, clearError } =
    useResumesClient(user?.id || null);
  const [resume, setResume] = useState<UserResume | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchResume = async () => {
    if (user?.id) {
      const currentResume = await getCurrentResume();
      setResume(currentResume);
      if (currentResume) {
        onResumeUpdated?.(currentResume);
      }
    }
  };

  const handleDelete = async () => {
    if (!resume?.id) return;

    try {
      setDeleting(true);
      clearError();

      const success = await deleteResume(resume.id);

      if (success) {
        setResume(null);
        onResumeDeleted?.();
      }
    } catch (err) {
      // Error is handled by the hook
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Extract filename from URL
  const getFileName = (url: string) => {
    try {
      // Get the last part of the URL path
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      // Remove any query parameters
      return fileName.split('?')[0] || 'Resume';
    } catch {
      return 'Resume';
    }
  };

  useEffect(() => {
    fetchResume();
  }, [user?.id, getCurrentResume]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading resume...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resume) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No resume uploaded</p>
            <p className="text-sm">Upload a resume to enable AI features</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Current Resume
        </CardTitle>
        <CardDescription>
          Your uploaded resume is being used for AI features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <FileText className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <FileInfo 
                  fileName={getFileName(resume.file_url)}
                  characterCount={resume.extracted_text?.length}
                  showCharacterCount={false}
                />
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Badge variant="secondary">
                    {getFileTypeLabel(resume.file_type)}
                  </Badge>
                  <span className="hidden sm:inline">•</span>
                  <span>Uploaded {formatDate(resume.uploaded_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-row sm:flex-col gap-2 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(resume.file_url, "_blank")}
                className="flex-1 sm:flex-initial"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={deleting} className="flex-1 sm:flex-initial">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Resume</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete your resume? This action
                      cannot be undone and will disable AI features that depend on
                      your resume.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Resume
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {resume.extracted_text && (
          <div className="space-y-2">
            <h4 className="font-medium">Extracted Text Preview</h4>
            <div className="p-3 border rounded-md bg-muted text-sm max-h-32 overflow-y-auto">
              {resume.extracted_text.substring(0, 300)}
              {resume.extracted_text.length > 300 && "..."}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
