"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useRateLimit } from "@/hooks/use-rate-limit";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { JobDescriptionInput } from "./shared/JobDescriptionInput";
import { AIToolLayout } from "./shared/AIToolLayout";
import { InterviewContextCard } from "./shared/InterviewContextCard";
import { InterviewPrepDisplay } from "./shared/InterviewPrepDisplay";
import { useAICoachData } from "@/contexts/ai-coach-data-context";
import { ResumeSelector } from "@/components/resume-management/ResumeSelector";
import { SavedItemCard } from "./shared/SavedItemCard";
import { Badge } from "@/components/ui/badge";

const InterviewPrep = () => {
  const searchParams = useSearchParams();
  const urlApplicationId = searchParams?.get("applicationId");
  const { user } = useSupabaseAuth();
  const {
    createInterviewPrep,
    loading: dalLoading,
    error,
    clearError,
  } = useAICoachClient(user?.id || null);
  const { getResumeText, loading: resumeLoading } = useResumesClient(
    user?.id || null
  );
  const {
    data,
    loading: cacheLoading,
    fetchInterviewPreps,
    invalidateCache,
  } = useAICoachData();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [interviewContext, setInterviewContext] = useState("");
  const [prep, setPrep] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedPreps, setShowSavedPreps] = useState(false);
  const { toast } = useToast();
  const copy = COPY.aiCoach.interviewPrep;
  
  // Check rate limits for this feature
  const { 
    canUseFeature, 
    isLimitReached, 
    limitMessage, 
    incrementUsage,
    hourlyRemaining,
    dailyRemaining 
  } = useRateLimit('interview_prep');

  // Initialize selected application from URL parameter
  useEffect(() => {
    if (urlApplicationId) {
      setSelectedApplicationId(urlApplicationId);
    }
  }, [urlApplicationId]);

  // Fetch saved interview preps on mount (uses cache)
  useEffect(() => {
    if (user?.id) {
      fetchInterviewPreps();
    }
  }, [user?.id, fetchInterviewPreps]);

  const deletePrep = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-coach/interview-prep/history/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        invalidateCache('interviewPreps');
        await fetchInterviewPreps(true);
        toast({
          title: "Deleted",
          description: "Interview preparation deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete interview preparation",
        variant: "destructive",
      });
    }
  };

  const extractContext = (prep: any) => {
    let company = "Unknown Company";
    let role = "Unknown Position";

    if (prep.interview_context) {
      const contextMatch = prep.interview_context.match(/Interview for (.+?) position at (.+)/);
      if (contextMatch) {
        role = contextMatch[1];
        company = contextMatch[2];
      }
    }
    return { company, role };
  };

  const parsePreparation = (prep: any) => {
    if (typeof prep.prep_content === 'object' && prep.prep_content !== null) {
      return prep.prep_content;
    }

    if (typeof prep.prep_content === 'string') {
      try {
        const parsed = JSON.parse(prep.prep_content);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          return parsed;
        }
      } catch {
        return null;
      }
    }

    return null;
  };

  const handleGenerate = async () => {
    // Check rate limit first
    if (!canUseFeature) {
      toast({
        title: "Rate Limit Reached",
        description: limitMessage || "You've reached the usage limit for this feature. Please try again later.",
        variant: "destructive",
      });
      return;
    }
    
    if (!jobDescription && !selectedApplicationId) {
      toast({
        title: "Job Description Required",
        description:
          ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.MISSING_JOB_DESCRIPTION,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setPrep(null);
    clearError();

    try {
      // Call backend API route for interview prep
      const payload: any = {
        interviewContext,
        jobDescription,
        applicationId: selectedApplicationId || undefined,
        resumeId: selectedResumeId || undefined,
        structured: true // Always request structured format for proper display
      };
      const response = await fetch("/api/ai-coach/interview-prep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate interview prep");
      }

      setPrep(data.preparation);

      // Save to database
      if (user?.id) {
        await createInterviewPrep(jobDescription, data.preparation);
        // Invalidate cache and refresh saved preps list
        invalidateCache('interviewPreps');
        await fetchInterviewPreps(true);
      }
      
      // Update rate limit usage
      await incrementUsage();

      toast({
        title: copy.successToast.title,
        description: copy.successToast.description,
      });
    } catch (error) {
      toast({
        title: "Error Generating Prep",
        description: (error as Error).message || ERROR_MESSAGES.UNEXPECTED,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isLoadingState = isLoading || dalLoading || resumeLoading;

  return (
    <AIToolLayout
      title={copy.title}
      description={`${copy.description}${resumeLoading ? " Loading your resume for personalized prep..." : ""}`}
      icon={<MessageSquare className="h-5 w-5" />}
      onSubmit={handleGenerate}
      submitLabel={copy.generateButton}
      isLoading={isLoadingState}
      error={error}
      isDisabled={!canUseFeature}
      disabledMessage={limitMessage}
      result={
        prep ? (
          typeof prep === 'string' ? (
            <MarkdownOutputCard
              title={copy.generatedTitle}
              icon={<MessageSquare className="h-5 w-5" />}
              content={prep}
            />
          ) : (
            <div data-interview-prep-display>
              <InterviewPrepDisplay
                content={prep}
                title={copy.generatedTitle}
                icon={<MessageSquare className="h-5 w-5" />}
              />
            </div>
          )
        ) : null
      }
      savedItemsCount={data.savedInterviewPreps.length}
      onViewSaved={() => setShowSavedPreps(!showSavedPreps)}
    >
      {showSavedPreps && data.savedInterviewPreps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Saved Interview Preparations</CardTitle>
            <CardDescription>
              Previously generated interview questions and preparations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.savedInterviewPreps.map((savedPrep: any) => {
                const { company, role } = extractContext(savedPrep);
                const parsedPrep = parsePreparation(savedPrep);
                const questionCount = parsedPrep?.questions?.length || 0;

                return (
                  <SavedItemCard
                    key={savedPrep.id}
                    id={savedPrep.id}
                    title={company}
                    subtitle={role}
                    timestamp={savedPrep.created_at}
                    badge={
                      questionCount > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {questionCount} questions
                        </Badge>
                      ) : undefined
                    }
                    onSelect={() => {
                      const preparation = parsePreparation(savedPrep);
                      if (preparation) {
                        setPrep(preparation);
                        setShowSavedPreps(false);
                      }
                    }}
                    onDelete={() => deletePrep(savedPrep.id)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ResumeSelector
              userId={user.id}
              selectedResumeId={selectedResumeId}
              onSelect={setSelectedResumeId}
              placeholder="Use default resume..."
              allowDefault={true}
            />
            <p className="text-xs text-muted-foreground">
              Choose which resume to prepare interview questions for
            </p>
          </CardContent>
        </Card>
      )}

      <JobDescriptionInput
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        label={copy.jobDescriptionLabel}
        placeholder={copy.jobDescriptionPlaceholder}
        onApplicationSelect={(appId, company, role) => {
          setSelectedApplicationId(appId);
          if (company && role) {
            setInterviewContext(`Interview for ${role} position at ${company}`);
          }
        }}
      />

      <InterviewContextCard
        interviewContext={interviewContext}
        onInterviewContextChange={setInterviewContext}
        label={copy.interviewContextLabel}
        placeholder={copy.interviewContextPlaceholder}
      />
    </AIToolLayout>
  );
};

export default InterviewPrep;
