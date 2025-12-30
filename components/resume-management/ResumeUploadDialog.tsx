"use client";

import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { RESUME_CONSTRAINTS, RESUME_ERROR_MESSAGES } from "@/lib/constants/resume";

interface ResumeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void;
}

export function ResumeUploadDialog({
  open,
  onOpenChange,
  onUploadSuccess,
}: ResumeUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFile(null);
    setName("");
    setDescription("");
    setSetAsDefault(false);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!RESUME_CONSTRAINTS.SUPPORTED_MIME_TYPES.includes(selectedFile.type)) {
      setError(RESUME_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE);
      return;
    }

    // Validate file size
    if (selectedFile.size > RESUME_CONSTRAINTS.MAX_FILE_SIZE) {
      setError(RESUME_ERROR_MESSAGES.FILE_TOO_LARGE);
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Auto-fill name from filename (remove extension)
    const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
    setName(fileName);
  };

  const validateForm = (): string | null => {
    if (!file) {
      return RESUME_ERROR_MESSAGES.NO_FILE_PROVIDED;
    }

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

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      formData.append("setAsDefault", String(setAsDefault));

      // Simulate progress (since we can't track real upload progress with fetch)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload resume");
      }

      // Success
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
        onUploadSuccess?.();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload resume");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Resume</DialogTitle>
          <DialogDescription>
            Upload a new resume to use with AI-powered features. Supported formats:
            PDF, Word (.doc/.docx), or text files.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* File Input */}
            <div className="space-y-2">
              <Label htmlFor="file">Resume File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="cursor-pointer"
                />
              </div>
              {file && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setName("");
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Maximum file size: 5MB
              </p>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Resume Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Software Engineer Resume"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={uploading}
                maxLength={RESUME_CONSTRAINTS.MAX_NAME_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/{RESUME_CONSTRAINTS.MAX_NAME_LENGTH} characters
              </p>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., Resume tailored for frontend roles"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                maxLength={RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/{RESUME_CONSTRAINTS.MAX_DESCRIPTION_LENGTH} characters
              </p>
            </div>

            {/* Set as Default Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                id="setAsDefault"
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                disabled={uploading}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="setAsDefault" className="font-normal cursor-pointer">
                Set as default resume for AI features
              </Label>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Resume
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
