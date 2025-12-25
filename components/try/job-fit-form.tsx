"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ResumeUploadField } from "./resume-upload-field";

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
  const [formData, setFormData] = useState<JobFitFormData>({
    jobDescription: "",
    userBackground: "",
    targetRole: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof JobFitFormData, string>>>({});

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
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
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
      {/* Job Description */}
      <div className="space-y-2">
        <Label htmlFor="jobDescription" className="text-base font-medium">
          Job Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="jobDescription"
          placeholder="Paste the job posting you're considering...

Example:
We're looking for a Senior Software Engineer to join our team. You'll work on building scalable web applications using React and Node.js.

Requirements:
- 5+ years of experience with JavaScript
- Strong knowledge of React and TypeScript
- Experience with Node.js and Express
..."
          value={formData.jobDescription}
          onChange={(e) => handleChange("jobDescription", e.target.value)}
          rows={10}
          className={errors.jobDescription ? "border-destructive" : ""}
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
      <ResumeUploadField
        value={formData.userBackground}
        onChange={(value) => handleChange("userBackground", value)}
        error={errors.userBackground}
        disabled={isLoading}
      />

      {/* Target Role (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="targetRole" className="text-base font-medium">
          Target Role (optional)
        </Label>
        <Input
          id="targetRole"
          placeholder="e.g., Senior Software Engineer, Product Manager, Marketing Director"
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
