"use client";

import { useState, useEffect } from "react";
import { FileText, Star, Download, Pencil, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResumeLimitIndicator } from "./ResumeLimitIndicator";
import type { UserResume } from "@/types";

interface ResumeListCardProps {
  userId: string;
  onUploadClick?: () => void;
  onEditClick?: (resume: UserResume) => void;
}

interface ListResponse {
  resumes: UserResume[];
  meta: {
    total: number;
    limit: number;
    current: number;
    canAdd: boolean;
    plan: string;
  };
}

export function ResumeListCard({
  userId,
  onUploadClick,
  onEditClick,
}: ResumeListCardProps) {
  const [resumes, setResumes] = useState<UserResume[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<UserResume | null>(null);

  const fetchResumes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/resume/list");

      if (!response.ok) {
        throw new Error("Failed to fetch resumes");
      }

      const data: ListResponse = await response.json();
      setResumes(data.resumes || []);
      setMeta(data.meta);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchResumes();
    }
  }, [userId]);

  const handleSetDefault = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resume/${resumeId}/default`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to set default resume");
      }

      // Refresh the list
      await fetchResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default");
    }
  };

  const handleDeleteClick = (resume: UserResume) => {
    setResumeToDelete(resume);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!resumeToDelete) return;

    setDeletingId(resumeToDelete.id);
    try {
      const response = await fetch(`/api/resume/${resumeToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete resume");
      }

      // Refresh the list
      await fetchResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resume");
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setResumeToDelete(null);
    }
  };

  const handleDownload = async (resume: UserResume) => {
    try {
      // Create a temporary link to download the file
      const link = document.createElement("a");
      link.href = resume.file_url;
      link.download = resume.name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError("Failed to download resume");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Resumes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading resumes...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && resumes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Resumes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={fetchResumes}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Your Resumes</CardTitle>
              <CardDescription>
                Manage your resumes and select which one to use for AI features
              </CardDescription>
            </div>
            {onUploadClick && meta?.canAdd && (
              <Button onClick={onUploadClick} size="sm">
                Upload Resume
              </Button>
            )}
          </div>

          {meta && (
            <div className="pt-4">
              <ResumeLimitIndicator
                userId={userId}
                variant="compact"
                showUpgrade={true}
              />
            </div>
          )}
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {resumes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No resumes uploaded</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your first resume to start using AI-powered features
              </p>
              {onUploadClick && (
                <Button onClick={onUploadClick}>
                  Upload Your First Resume
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {resumes.map((resume) => (
                <ResumeCard
                  key={resume.id}
                  resume={resume}
                  isDeleting={deletingId === resume.id}
                  onSetDefault={() => handleSetDefault(resume.id)}
                  onEdit={() => onEditClick?.(resume)}
                  onDelete={() => handleDeleteClick(resume)}
                  onDownload={() => handleDownload(resume)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resume</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{resumeToDelete?.name}&quot;?
              This action cannot be undone.
              {resumeToDelete?.is_default && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                  This is your default resume. Another resume will be automatically
                  set as default.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ResumeCardProps {
  resume: UserResume;
  isDeleting: boolean;
  onSetDefault: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

function ResumeCard({
  resume,
  isDeleting,
  onSetDefault,
  onEdit,
  onDelete,
  onDownload,
}: ResumeCardProps) {
  const uploadDate = new Date(resume.uploaded_at).toLocaleDateString();
  const fileType = resume.file_type.split("/").pop()?.toUpperCase() || "FILE";

  return (
    <Card className="relative group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <CardTitle className="text-base truncate">
                {resume.name}
              </CardTitle>
              {resume.is_default && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {fileType}
              </Badge>
              {resume.is_default && (
                <Badge variant="default" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isDeleting}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!resume.is_default && (
                <>
                  <DropdownMenuItem onClick={onSetDefault}>
                    <Star className="h-4 w-4 mr-2" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {resume.description && (
          <CardDescription className="text-xs line-clamp-2 mt-2">
            {resume.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Uploaded {uploadDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
