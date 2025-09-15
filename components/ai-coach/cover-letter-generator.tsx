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
  Link,
  Info,
  RefreshCw,
  History,
  Trash2,
  Eye,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { ResumeSection } from "./shared/ResumeSection";
import { JobDescriptionInputTabs } from "./shared/JobDescriptionInputTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupabaseApplications } from "@/hooks/use-supabase-applications";

const CoverLetterGenerator = () => {
  const { user, loading: authLoading } = useSupabaseAuth();
  const { getCurrentResume } = useResumesClient(user?.id || null);
  const { applications } = useSupabaseApplications(user?.id || null);
  const { toast } = useToast();
  
  // State management
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "url">("text");
  const [companyName, setCompanyName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [tone, setTone] = useState("professional");
  const [additionalInfo, setAdditionalInfo] = useState("");
  
  // Resume state
  const [userHasResume, setUserHasResume] = useState(false);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const [currentResumeText, setCurrentResumeText] = useState("");
  const [resumeText, setResumeText] = useState("");
  
  // Application selection state
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  
  // Saved cover letters state
  const [savedCoverLetters, setSavedCoverLetters] = useState<any[]>([]);
  const [showSavedLetters, setShowSavedLetters] = useState(false);

  // Check for existing resume on mount
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setIsCheckingResume(false);
      return;
    }

    const checkUserResume = async () => {
      try {
        const resumeObj = await getCurrentResume();
        if (resumeObj) {
          setUserHasResume(true);
          setCurrentResumeText(resumeObj.extracted_text || "");
        } else {
          setUserHasResume(false);
          setCurrentResumeText("");
        }
      } catch (err) {
        console.error("Error checking user resume:", err);
        setUserHasResume(false);
        setCurrentResumeText("");
      } finally {
        setIsCheckingResume(false);
      }
    };

    checkUserResume();
  }, [user?.id, authLoading, getCurrentResume]);

  const handleApplicationSelect = (applicationId: string) => {
    const app = applications.find((a) => a.id === applicationId);
    if (app) {
      setCompanyName(app.company || "");
      setRoleName(app.role || "");
      if (app.job_description) {
        setJobDescription(app.job_description);
        setInputMethod("text");
      }
    }
    setSelectedApplicationId(applicationId);
  };

  const generateCoverLetter = async () => {
    // Validation
    if (!companyName.trim() || !roleName.trim()) {
      setError("Please provide both company name and role name");
      return;
    }

    if (inputMethod === "text" && !jobDescription.trim()) {
      setError("Please provide a job description");
      return;
    }

    if (inputMethod === "url" && !jobUrl.trim()) {
      setError("Please provide a job URL");
      return;
    }

    const effectiveResumeText = resumeText || currentResumeText;
    if (!effectiveResumeText) {
      setError("Please upload a resume first");
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
          userBackground: effectiveResumeText,
          jobDescription: inputMethod === "text" ? jobDescription : undefined,
          jobUrl: inputMethod === "url" ? jobUrl : undefined,
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
      
      // Refresh saved letters list
      await fetchSavedCoverLetters();
      
      toast({
        title: "Cover letter generated!",
        description: "Your personalized cover letter is ready and saved.",
      });
    } catch (err: any) {
      console.error("Error generating cover letter:", err);
      setError(err.message || ERROR_MESSAGES.GENERIC);
      toast({
        title: "Generation failed",
        description: err.message || ERROR_MESSAGES.GENERIC,
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
    setJobUrl("");
    setCompanyName("");
    setRoleName("");
    setAdditionalInfo("");
    setSelectedApplicationId("");
    setError("");
  };

  const fetchSavedCoverLetters = async () => {
    try {
      const response = await fetch("/api/ai-coach/cover-letters");
      if (response.ok) {
        const data = await response.json();
        setSavedCoverLetters(data.coverLetters || []);
      }
    } catch (error) {
      console.error("Error fetching saved cover letters:", error);
    }
  };

  const deleteCoverLetter = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-coach/cover-letters?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSavedCoverLetters(prev => prev.filter(cl => cl.id !== id));
        toast({
          title: "Deleted",
          description: "Cover letter deleted successfully",
        });
      }
    } catch (error) {
      console.error("Error deleting cover letter:", error);
      toast({
        title: "Error",
        description: "Failed to delete cover letter",
        variant: "destructive",
      });
    }
  };

  // Fetch saved cover letters on mount
  useEffect(() => {
    if (user?.id) {
      fetchSavedCoverLetters();
    }
  }, [user?.id]);

  if (isCheckingResume) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Sparkles className="h-8 w-8 animate-pulse mx-auto text-primary" />
              <p className="text-muted-foreground">Loading your profile...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cover Letter Generator
              </CardTitle>
              <CardDescription className="mt-1">
                Create personalized, compelling cover letters tailored to each job opportunity
              </CardDescription>
            </div>
            {savedCoverLetters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSavedLetters(!showSavedLetters)}
              >
                <History className="h-4 w-4 mr-2" />
                Saved Letters ({savedCoverLetters.length})
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Saved Cover Letters */}
      {showSavedLetters && savedCoverLetters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Saved Cover Letters</CardTitle>
            <CardDescription>
              Previously generated cover letters for your applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savedCoverLetters.map((letter) => (
                <div
                  key={letter.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{letter.company_name}</div>
                      {letter.role_name && (
                        <div className="text-sm text-muted-foreground">{letter.role_name}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(letter.created_at).toLocaleDateString()} at{" "}
                        {new Date(letter.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCoverLetter(letter.cover_letter);
                          setShowSavedLetters(false);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(letter.cover_letter);
                          toast({
                            title: "Copied!",
                            description: "Cover letter copied to clipboard",
                          });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCoverLetter(letter.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!coverLetter ? (
        <div className="space-y-6">
          {/* Resume Section */}
          <ResumeSection
            userHasResume={userHasResume}
            currentResumeText={currentResumeText}
            onResumeTextChange={setResumeText}
            resumeText={resumeText}
          />

          {/* Quick Fill from Applications */}
          {applications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Fill</CardTitle>
                <CardDescription>
                  Select from your recent applications to auto-fill details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedApplicationId} onValueChange={handleApplicationSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an application..." />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.company} - {app.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Job Details Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
              <CardDescription>
                Provide information about the position you're applying for
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

              <JobDescriptionInputTabs
                inputMethod={inputMethod}
                setInputMethod={setInputMethod}
                jobDescription={jobDescription}
                setJobDescription={setJobDescription}
                jobUrl={jobUrl}
                setJobUrl={setJobUrl}
              />

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

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={generateCoverLetter}
              disabled={loading || (!currentResumeText && !resumeText)}
              className="min-w-[200px]"
            >
              {loading ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Cover Letter
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Generated Cover Letter */}
          <MarkdownOutputCard
            title="Your Cover Letter"
            content={coverLetter}
            className="min-h-[400px]"
          />

          {/* Action Buttons */}
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

          {/* Tips Card */}
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
      )}
    </div>
  );
};

export default CoverLetterGenerator;