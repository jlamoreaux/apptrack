"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ResumeUploadField } from "./resume-upload-field";
import { useFormPersistence } from "@/lib/hooks/use-form-persistence";

export interface InterviewPrepFormData {
  jobDescription: string;
  userBackground: string;
  interviewType?: string;
}

interface InterviewPrepFormProps {
  onSubmit: (data: InterviewPrepFormData) => Promise<void>;
  isLoading?: boolean;
}

const initialFormData: InterviewPrepFormData = {
  jobDescription: "",
  userBackground: "",
  interviewType: "",
};

export function InterviewPrepForm({ onSubmit, isLoading = false }: InterviewPrepFormProps) {
  const { formData, setFormData, clearSavedData, hasRestoredData } = useFormPersistence<InterviewPrepFormData>(
    "interview-prep",
    initialFormData
  );
  const [errors, setErrors] = useState<Partial<Record<keyof InterviewPrepFormData, string>>>({});

  // Refs for scrolling to errors
  const jobDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const userBackgroundRef = useRef<HTMLDivElement>(null);

  const scrollToFirstError = useCallback((newErrors: Partial<Record<keyof InterviewPrepFormData, string>>) => {
    if (newErrors.jobDescription && jobDescriptionRef.current) {
      jobDescriptionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      jobDescriptionRef.current.focus();
    } else if (newErrors.userBackground && userBackgroundRef.current) {
      userBackgroundRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const textarea = userBackgroundRef.current.querySelector('textarea');
      textarea?.focus();
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof InterviewPrepFormData, string>> = {};
    if (formData.jobDescription.length < 100) {
      newErrors.jobDescription = "Job description must be at least 100 characters";
    }
    if (formData.userBackground.length < 50) {
      newErrors.userBackground = "Background must be at least 50 characters";
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => scrollToFirstError(newErrors), 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      clearSavedData();
      await onSubmit(formData);
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
              setFormData(initialFormData);
            }}
            className="text-primary hover:underline text-xs"
          >
            Clear
          </button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="interviewType">
          Interview Type <span className="text-muted-foreground text-sm">(optional)</span>
        </Label>
        <Input
          id="interviewType"
          value={formData.interviewType}
          onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
          placeholder="e.g., Phone screen, Technical, Behavioral, Final round"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobDescription">
          Job Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          ref={jobDescriptionRef}
          id="jobDescription"
          value={formData.jobDescription}
          onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
          placeholder="Paste the full job description here..."
          rows={8}
          disabled={isLoading}
          className={errors.jobDescription ? "border-destructive ring-2 ring-destructive ring-offset-2" : ""}
        />
        <div className="flex justify-between text-sm">
          {errors.jobDescription ? (
            <p className="text-red-600">{errors.jobDescription}</p>
          ) : (
            <p className="text-muted-foreground">Minimum 100 characters</p>
          )}
          <p className={formData.jobDescription.length < 100 ? "text-muted-foreground" : "text-green-600"}>
            {formData.jobDescription.length} characters
          </p>
        </div>
      </div>

      <div ref={userBackgroundRef}>
        <ResumeUploadField
          value={formData.userBackground}
          onChange={(value) => setFormData({ ...formData, userBackground: value })}
          error={errors.userBackground}
          disabled={isLoading}
          label="Your Background / Resume"
          highlightError={!!errors.userBackground}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating Questions...
          </>
        ) : (
          "Generate Interview Questions"
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        One free trial daily • Quick signup • Takes ~30 seconds
      </p>
    </form>
  );
}
