"use client";

import { useState, useEffect, FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RESUME_CONSTRAINTS } from "@/lib/constants/resume";
import type { UserResume } from "@/types";

interface ResumeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: UserResume | null;
  onEditSuccess?: () => void;
  onDeleteSuccess?: () => void;
}

export function ResumeEditDialog({
  open,
  onOpenChange,
  resume,
  onEditSuccess,
  onDeleteSuccess,
}: ResumeEditDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when resume changes
  useEffect(() => {
    if (resume) {
      setName(resume.name);
      setDescription(resume.description || "");
      setError(null);
    }
  }, [resume]);

  const resetForm = () => {
    if (resume) {
      setName(resume.name);
      setDescription(resume.description || "");
    }
    setError(null);
  };

  const handleClose = () => {
    if (!saving && !deleting) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!resume) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/resume/${resume.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete resume");
      }

      // Success
      setShowDeleteConfirm(false);
      handleClose();
      onDeleteSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resume");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "Resume name is required";
    }

    if (name.length > RESUME_CONSTRAINTS.MAX_NAME_LENGTH) {
      return `Resume name must be less than ${RESUME_CONSTRAINTS.MAX_NAME_LENGTH} characters`;
    }

    if (description.length > RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH) {
      return `Description must be less than ${RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH} characters`;
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!resume) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if anything changed
    if (
      name.trim() === resume.name &&
      (description.trim() || null) === resume.description
    ) {
      handleClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/resume/${resume.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update resume");
      }

      // Success
      handleClose();
      onEditSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update resume");
    } finally {
      setSaving(false);
    }
  };

  if (!resume) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Resume</DialogTitle>
          <DialogDescription>
            Update the name and description of your resume. The file itself cannot
            be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Resume Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="e.g., Software Engineer Resume"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                maxLength={RESUME_CONSTRAINTS.MAX_NAME_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/{RESUME_CONSTRAINTS.MAX_NAME_LENGTH} characters
              </p>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="e.g., Resume tailored for frontend roles"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                maxLength={RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/{RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH} characters
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 flex justify-start">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Resume
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saving || deleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || deleting}>
                {saving ? (
                  <>
                    <Pencil className="h-4 w-4 mr-2 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resume?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{resume.name}"? This action cannot be undone.
              {resume.is_default && " If this is your default resume, another resume will be automatically set as default."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Resume"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
