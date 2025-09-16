"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Briefcase, FileText, Link, AlertCircle } from "lucide-react";
import { useSupabaseApplications } from "@/hooks/use-supabase-applications";
import { getAIContextAction } from "@/lib/actions/ai-data";

interface JobDescriptionInputProps {
  jobDescription: string;
  setJobDescription: (value: string) => void;
  placeholder?: string;
  label?: string;
  onApplicationSelect?: (applicationId: string, companyName?: string, roleName?: string) => void;
}

export function JobDescriptionInput({
  jobDescription,
  setJobDescription,
  placeholder = "Paste the full job description here...",
  label = "Job Description",
  onApplicationSelect,
}: JobDescriptionInputProps) {
  const { applications } = useSupabaseApplications();
  const [inputMethod, setInputMethod] = useState<"application" | "text" | "url">("text");
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [jobUrl, setJobUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedJobDescription, setSavedJobDescription] = useState("");

  // Load saved data when an application is selected
  useEffect(() => {
    const loadApplicationData = async () => {
      if (selectedApplicationId && inputMethod === "application") {
        setIsLoading(true);
        try {
          const result = await getAIContextAction(selectedApplicationId);
          if (result.data) {
            if (result.data.jobDescription) {
              setSavedJobDescription(result.data.jobDescription);
              setJobDescription(result.data.jobDescription);
            }
            if (result.data.applicationData && onApplicationSelect) {
              const { company, role } = result.data.applicationData;
              onApplicationSelect(selectedApplicationId, company, role);
            }
          }
        } catch (error) {
          console.error("Error loading application data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadApplicationData();
  }, [selectedApplicationId, inputMethod, setJobDescription, onApplicationSelect]);

  // Update job description based on input method
  useEffect(() => {
    if (inputMethod === "text") {
      // Clear saved description when switching to manual input
      setSavedJobDescription("");
    } else if (inputMethod === "url" && jobUrl) {
      // For URL input, we'd fetch the job description from the URL
      // This would require an API endpoint to scrape the job posting
      setJobDescription(jobUrl); // For now, just use the URL as placeholder
    }
  }, [inputMethod, jobUrl, setJobDescription]);

  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      
      {/* Method selector */}
      <div className="flex gap-2">
        <Button
          variant={inputMethod === "application" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMethod("application")}
          type="button"
        >
          <Briefcase className="mr-1 h-3 w-3" />
          Saved Application
        </Button>
        <Button
          variant={inputMethod === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMethod("text")}
          type="button"
        >
          <FileText className="mr-1 h-3 w-3" />
          Paste Description
        </Button>
        <Button
          variant={inputMethod === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMethod("url")}
          type="button"
        >
          <Link className="mr-1 h-3 w-3" />
          From URL
        </Button>
      </div>

      {/* Input based on method */}
      {inputMethod === "application" ? (
        <div className="space-y-3">
          <Select
            value={selectedApplicationId}
            onValueChange={setSelectedApplicationId}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an application" />
            </SelectTrigger>
            <SelectContent>
              {applications?.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No applications found. Add an application first.
                </div>
              ) : (
                applications?.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.company} - {app.role}
                    {app.date_applied && ` (${new Date(app.date_applied).toLocaleDateString()})`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          {savedJobDescription && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Job Description Loaded:</p>
                <p className="text-sm line-clamp-3">{savedJobDescription}</p>
              </AlertDescription>
            </Alert>
          )}
          
          {selectedApplicationId && !savedJobDescription && !isLoading && (
            <Alert>
              <AlertDescription>
                No job description saved for this application. You can paste one below.
              </AlertDescription>
            </Alert>
          )}
          
          {selectedApplicationId && !savedJobDescription && (
            <Textarea
              placeholder="No saved job description. Paste it here to save for future use..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[150px]"
              disabled={isLoading}
            />
          )}
        </div>
      ) : inputMethod === "url" ? (
        <Input
          type="url"
          placeholder="https://company.com/jobs/position"
          value={jobUrl}
          onChange={(e) => setJobUrl(e.target.value)}
          disabled={isLoading}
        />
      ) : (
        <Textarea
          placeholder={placeholder}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="min-h-[200px]"
          disabled={isLoading}
        />
      )}
    </div>
  );
}