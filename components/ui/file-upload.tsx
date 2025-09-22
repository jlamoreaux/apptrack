"use client";

import { useState, useCallback, useId } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  // Core props
  onFileSelect: (file: File) => void | Promise<void>;
  accept?: string;
  maxSize?: number; // in bytes
  
  // UI customization
  title?: string;
  description?: string;
  buttonText?: string;
  dragText?: string;
  className?: string;
  showCard?: boolean;
  
  // State
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
  success?: string | null;
  selectedFile?: File | null;
  
  // Validation
  validateFile?: (file: File) => { valid: boolean; error?: string };
  supportedFormats?: string[];
}

export function FileUpload({
  onFileSelect,
  accept = ".pdf,.doc,.docx,.txt",
  maxSize = 5 * 1024 * 1024, // 5MB default
  title,
  description,
  buttonText = "Choose File",
  dragText = "Drop your file here",
  className,
  showCard = false,
  isUploading = false,
  uploadProgress,
  error,
  success,
  selectedFile,
  validateFile,
  supportedFormats = ["PDF", "DOC", "DOCX", "TXT"],
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setLocalError(null);

    // Custom validation
    if (validateFile) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setLocalError(validation.error || "Invalid file");
        return;
      }
    }

    // Size validation
    if (file.size > maxSize) {
      setLocalError(`File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    try {
      await onFileSelect(file);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to process file");
    }
  }, [onFileSelect, maxSize, validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const displayError = error || localError;
  // Use useId hook for stable IDs across server/client
  const inputId = useId();

  const content = (
    <>
      {displayError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {selectedFile && (
        <div className="mb-4 p-3 bg-secondary/10 rounded-lg flex items-center gap-3">
          <FileText className="h-5 w-5 text-secondary" />
          <div className="flex-1">
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-50",
          !showCard && "w-full"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">
          {isUploading ? "Processing..." : dragText}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse files
        </p>
        <Button
          variant="outline"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            buttonText
          )}
        </Button>
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isUploading}
        />
      </div>

      {uploadProgress !== undefined && isUploading && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Supported formats: {supportedFormats.join(", ")}</p>
        <p>Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB</p>
      </div>
    </>
  );

  if (showCard) {
    return (
      <div className={cn("rounded-lg border bg-card", className)}>
        {(title || description) && (
          <div className="p-6 pb-0">
            {title && (
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-2">{description}</p>
            )}
          </div>
        )}
        <div className="p-6">{content}</div>
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}