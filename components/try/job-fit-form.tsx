"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ResumeUploadField } from "./resume-upload-field";
import { useFormPersistence } from "@/lib/hooks/use-form-persistence";

export interface JobFitFormData {
  jobDescription: string;
  userBackground: string;
  targetRole?: string;
}

interface JobFitFormProps {
  onSubmit: (data: JobFitFormData) => void;
  isLoading?: boolean;
}

export function JobFitForm({ onSubmit, isLoading }: JobFitFormProps) {
  const { formData, setFormData, clearSavedData, hasRestoredData } = useFormPersistence<JobFitFormData>(
    "job-fit",
    {
      jobDescription: "",
      userBackground: "",
      targetRole: "",
    }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof JobFitFormData, string>>>({});

  // Refs for scrolling to errors
  const jobDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const userBackgroundRef = useRef<HTMLDivElement>(null);

  const scrollToFirstError = useCallback((newErrors: Partial<Record<keyof JobFitFormData, string>>) => {
    // Determine which field has the first error and scroll to it
    if (newErrors.jobDescription && jobDescriptionRef.current) {
      jobDescriptionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      jobDescriptionRef.current.focus();
    } else if (newErrors.userBackground && userBackgroundRef.current) {
      userBackgroundRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the textarea inside the ResumeUploadField
      const textarea = userBackgroundRef.current.querySelector('textarea');
      textarea?.focus();
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof JobFitFormData, string>> = {};

    // Job description validation
    if (!formData.jobDescription.trim()) {
      newErrors.jobDescription = "Job description is required";
    } else if (formData.jobDescription.trim().length < 100) {
      newErrors.jobDescription = "Job description must be at least 100 characters";
    }

    // User background validation
    if (!formData.userBackground.trim()) {
      newErrors.userBackground = "Your background is required";
    } else if (formData.userBackground.trim().length < 50) {
      newErrors.userBackground = "Please provide at least 50 characters about your background";
    }

    setErrors(newErrors);

    // Scroll to first error if validation fails
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => scrollToFirstError(newErrors), 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      clearSavedData();
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof JobFitFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasRestoredData && (
        <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-sm">
          <span className="text-muted-foreground">Your previous input was restored</span>
          <button
            type="button"
            onClick={() => {
              clearSavedData();
              setFormData({ jobDescription: "", userBackground: "", targetRole: "" });
            }}
            className="text-primary hover:underline text-xs"
          >
            Clear
          </button>
        </div>
      )}

      {/* Job Description */}
      <div className="space-y-2">
        <Label htmlFor="jobDescription" className="text-base font-medium">
          Job Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          ref={jobDescriptionRef}
          id="jobDescription"
          placeholder="Paste the full job description here..."
          value={formData.jobDescription}
          onChange={(e) => handleChange("jobDescription", e.target.value)}
          rows={10}
          className={errors.jobDescription ? "border-destructive ring-2 ring-destructive ring-offset-2" : ""}
          disabled={isLoading}
        />
        {errors.jobDescription && (
          <p className="text-sm text-destructive">{errors.jobDescription}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formData.jobDescription.length} characters (minimum 100)
        </p>
      </div>

      {/* User Background */}
      <div ref={userBackgroundRef}>
        <ResumeUploadField
          value={formData.userBackground}
          onChange={(value) => handleChange("userBackground", value)}
          error={errors.userBackground}
          disabled={isLoading}
          highlightError={!!errors.userBackground}
        />
      </div>

      {/* Target Role (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="targetRole" className="text-base font-medium">
          Target Role (optional)
        </Label>
        <Input
          id="targetRole"
          placeholder="e.g., Senior Software Engineer"
          value={formData.targetRole}
          onChange={(e) => handleChange("targetRole", e.target.value)}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          We'll try to auto-detect from the job description if not provided
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing your fit...
          </>
        ) : (
          "Analyze My Fit"
        )}
      </Button>

      {/* Privacy Note */}
      <p className="text-xs text-center text-muted-foreground">
        Your information is only used for this analysis and not stored permanently
      </p>
    </form>
  );
}
