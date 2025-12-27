"use client";

import { useState, useRef, useCallback } from "react";

interface UseResumeUploadOptions {
  onSuccess?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseResumeUploadReturn {
  uploadedFile: File | null;
  isUploading: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFile: () => void;
  triggerFileSelect: () => void;
}

export function useResumeUpload(options: UseResumeUploadOptions = {}): UseResumeUploadReturn {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/try/upload-resume", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process file");
      }

      setUploadedFile(file);
      options.onSuccess?.(data.text);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload file";
      setError(errorMessage);
      options.onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [options]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const clearFile = useCallback(() => {
    setUploadedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    uploadedFile,
    isUploading,
    error,
    fileInputRef,
    handleFileSelect,
    clearFile,
    triggerFileSelect,
  };
}
