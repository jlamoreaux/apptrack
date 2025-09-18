"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Sparkles,
  AlertCircle,
  Download,
  Copy,
  Info,
  RefreshCw,
  History,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { AIToolLayout } from "./shared/AIToolLayout";
import { ResumeAndJobInput } from "./shared/ResumeAndJobInput";
import { SavedItemCard } from "./shared/SavedItemCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupabaseApplications } from "@/hooks/use-supabase-applications";
import { useAICoachData } from "@/contexts/ai-coach-data-context";

const CoverLetterGenerator = () => {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const {
    data,
    loading: cacheLoading,
    fetchCoverLetters,
    fetchApplications,
    fetchResume,
    invalidateCache,
  } = useAICoachData();
  
  // State management
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [tone, setTone] = useState("professional");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  
  // Saved cover letters state
  const [showSavedLetters, setShowSavedLetters] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);


  // Load cached data on mount
  useEffect(() => {
    if (user?.id && !hasInitialized) {
      setHasInitialized(true);
      fetchCoverLetters();
      fetchApplications();
      // Pre-load resume for faster UX
      fetchResume().then(text => {
        if (text) setResumeText(text);
      });
    }
  }, [user?.id, hasInitialized]);
  
  // Also sync with cached data when it becomes available
  useEffect(() => {
    if (data.resumeText && !resumeText) {
      setResumeText(data.resumeText);
    }
  }, [data.resumeText]);

  const handleApplicationSelect = (appId: string, company?: string, role?: string) => {
    const app = data.applications.find((a) => a.id === appId);
    if (app) {
      setCompanyName(company || app.company || "");
      setRoleName(role || app.role || "");
      if (app.job_description) {
        setJobDescription(app.job_description);
      }
    }
    setSelectedApplicationId(appId);
  };

  const generateCoverLetter = async () => {
    // Validation
    if (!companyName.trim() || !roleName.trim()) {
      setError("Please provide both company name and role name");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please provide a job description");
      return;
    }

    if (!resumeText) {
      setError("Please upload or paste your resume");
      return;
    }

    setLoading(true);
    setError("");
    setCoverLetter("");

    try {
      const response = await fetch("/api/ai-coach/cover-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userBackground: resumeText,
          jobDescription,
          companyName,
          roleName,
          tone,
          additionalInfo: additionalInfo.trim() || undefined,
          applicationId: selectedApplicationId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate cover letter");
      }

      const data = await response.json();
      setCoverLetter(data.coverLetter);
      
      // Invalidate cache and refresh saved letters list
      invalidateCache('coverLetters');
      await fetchCoverLetters(true);
      
      toast({
        title: "Cover letter generated!",
        description: "Your personalized cover letter is ready and saved.",
      });
    } catch (err: any) {
      setError(err.message || ERROR_MESSAGES.UNEXPECTED);
      toast({
        title: "Generation failed",
        description: err.message || ERROR_MESSAGES.UNEXPECTED,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    toast({
      title: "Copied!",
      description: "Cover letter copied to clipboard",
    });
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([coverLetter], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `cover-letter-${companyName.replace(/\s+/g, "-")}-${roleName.replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Downloaded!",
      description: "Cover letter saved to your downloads folder",
    });
  };

  const handleReset = () => {
    setCoverLetter("");
    setJobDescription("");
    setCompanyName("");
    setRoleName("");
    setAdditionalInfo("");
    setSelectedApplicationId("");
    setError("");
  };


  const deleteCoverLetter = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-coach/cover-letters?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Invalidate cache and refresh
        invalidateCache('coverLetters');
        await fetchCoverLetters(true);
        toast({
          title: "Deleted",
          description: "Cover letter deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete cover letter",
        variant: "destructive",
      });
    }
  };



  const handleResumeUpload = async (file: File) => {
    // Process the file and extract text
    if (file.type === "text/plain") {
      const text = await file.text();
      setResumeText(text);
    } else {
      // For PDFs and other formats, you would need to process them
      // This would typically be done via an API endpoint
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        const response = await fetch("/api/resume/upload", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          // Handle both old and new response formats
          const extractedText = data.text || data.resume?.extracted_text;
          if (extractedText) {
            setResumeText(extractedText);
          }
        }
      } catch (error) {
        toast({
          title: "Upload failed",
          description: "Failed to process resume file",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <AIToolLayout
      title="Cover Letter Generator"
      description="Create personalized, compelling cover letters tailored to each job opportunity"
      icon={<FileText className="h-5 w-5" />}
      onSubmit={generateCoverLetter}
      submitLabel="Generate Cover Letter"
      isLoading={loading}
      error={error}
      result={coverLetter ? (
        <div className="space-y-6">
          <MarkdownOutputCard
            title="Your Cover Letter"
            content={coverLetter}
          />
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={handleCopy} variant="outline">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </Button>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download as Text
                </Button>
                <Button onClick={() => generateCoverLetter()} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-4 w-4" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Review and personalize the generated content to match your voice</li>
                <li>• Ensure all company and role names are correct</li>
                <li>• Add specific examples or achievements if needed</li>
                <li>• Proofread for any errors before sending</li>
                <li>• Save a copy for your records</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
      savedItemsCount={data.savedCoverLetters.length}
      onViewSaved={() => setShowSavedLetters(!showSavedLetters)}
    >

      {showSavedLetters && data.savedCoverLetters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Saved Cover Letters</CardTitle>
            <CardDescription>
              Previously generated cover letters for your applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.savedCoverLetters.map((letter) => (
                <SavedItemCard
                  key={letter.id}
                  id={letter.id}
                  title={letter.company_name}
                  subtitle={letter.role_name}
                  timestamp={letter.created_at}
                  onSelect={() => {
                    setCoverLetter(letter.cover_letter);
                    setShowSavedLetters(false);
                  }}
                  onDelete={() => deleteCoverLetter(letter.id)}
                  onCopy={() => {
                    navigator.clipboard.writeText(letter.cover_letter);
                    toast({
                      title: "Copied!",
                      description: "Cover letter copied to clipboard",
                    });
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <ResumeAndJobInput
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        resumeText={resumeText}
        setResumeText={setResumeText}
        onApplicationSelect={handleApplicationSelect}
        jobDescriptionLabel="Job Description"
        jobDescriptionOptional={false}
        allowResumeUpload={true}
        onResumeUpload={handleResumeUpload}
      />
      
      {/* Additional Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cover Letter Details</CardTitle>
          <CardDescription>
            Customize the tone and content of your cover letter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company Name *</Label>
              <Input
                id="company"
                placeholder="e.g., Google"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role/Position *</Label>
              <Input
                id="role"
                placeholder="e.g., Senior Software Engineer"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tone">Cover Letter Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="additional">
              Additional Information (Optional)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 inline ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Add any specific points you want to emphasize, such as why you're interested
                      in this company or relevant achievements
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Textarea
              id="additional"
              placeholder="e.g., I'm particularly excited about your company's mission to... I recently achieved..."
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </AIToolLayout>
  );
};

export default CoverLetterGenerator;