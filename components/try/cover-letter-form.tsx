"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ResumeUploadField } from "./resume-upload-field";
import { useFormPersistence } from "@/lib/hooks/use-form-persistence";
import { useScrollToError } from "@/lib/hooks/use-scroll-to-error";

export interface CoverLetterFormData {
  jobDescription: string;
  userBackground: string;
  companyName: string;
  roleName?: string;
}

interface CoverLetterFormProps {
  onSubmit: (data: CoverLetterFormData) => Promise<void>;
  isLoading?: boolean;
}

const initialFormData: CoverLetterFormData = {
  jobDescription: "",
  userBackground: "",
  companyName: "",
  roleName: "",
};

export function CoverLetterForm({ onSubmit, isLoading = false }: CoverLetterFormProps) {
  const { formData, setFormData, clearSavedData, hasRestoredData } = useFormPersistence<CoverLetterFormData>(
    "cover-letter",
    initialFormData
  );

  const [errors, setErrors] = useState<Partial<Record<keyof CoverLetterFormData, string>>>({});

  const { refs, scrollToFirstError } = useScrollToError<keyof CoverLetterFormData>([
    'companyName',
    'jobDescription',
    'userBackground',
  ]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CoverLetterFormData, string>> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }

    if (formData.jobDescription.length < 100) {
      newErrors.jobDescription = "Job description must be at least 100 characters";
    }

    if (formData.userBackground.length < 50) {
      newErrors.userBackground = "Background must be at least 50 characters";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      scrollToFirstError(newErrors);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    clearSavedData();
    await onSubmit(formData);
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

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="companyName">
          Company Name <span className="text-destructive">*</span>
        </Label>
        <Input
          ref={refs.companyName as React.RefObject<HTMLInputElement>}
          id="companyName"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          placeholder="e.g., Google, Microsoft, Acme Corp"
          disabled={isLoading}
          className={errors.companyName ? "border-destructive ring-2 ring-destructive ring-offset-2" : ""}
        />
        {errors.companyName && (
          <p className="text-sm text-destructive">{errors.companyName}</p>
        )}
      </div>

      {/* Role Name (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="roleName">
          Role / Position Title <span className="text-muted-foreground text-sm">(optional)</span>
        </Label>
        <Input
          id="roleName"
          value={formData.roleName}
          onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
          placeholder="e.g., Senior Software Engineer, Product Manager"
          disabled={isLoading}
        />
      </div>

      {/* Job Description */}
      <div className="space-y-2">
        <Label htmlFor="jobDescription">
          Job Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          ref={refs.jobDescription as React.RefObject<HTMLTextAreaElement>}
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
            <p className="text-destructive">{errors.jobDescription}</p>
          ) : (
            <p className="text-muted-foreground">
              Minimum 100 characters
            </p>
          )}
          <p className={`${
            formData.jobDescription.length < 100
              ? "text-muted-foreground"
              : "text-green-600"
          }`}>
            {formData.jobDescription.length} characters
          </p>
        </div>
      </div>

      {/* User Background */}
      <div ref={refs.userBackground as React.RefObject<HTMLDivElement>}>
        <ResumeUploadField
          value={formData.userBackground}
          onChange={(value) => setFormData({ ...formData, userBackground: value })}
          error={errors.userBackground}
          disabled={isLoading}
          label="Your Background / Resume"
          highlightError={!!errors.userBackground}
        />
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
            Generating Cover Letter...
          </>
        ) : (
          "Generate Cover Letter"
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        One free trial daily • Quick signup • Takes ~30 seconds
      </p>
    </form>
  );
}
