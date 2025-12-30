"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  MessageSquare,
  FileText,
  BarChart3,
  ExternalLink,
  Eye,
  Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { MarkdownOutputCard } from "./shared/MarkdownOutput";
import { InterviewPrepDisplay } from "./shared/InterviewPrepDisplay";

interface AnalysisHistoryProps {
  resumeId?: string; // Optional: filter by specific resume
}

export function AnalysisHistory({ resumeId }: AnalysisHistoryProps) {
  const { user } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<any>({
    jobFit: [],
    coverLetters: [],
    interviewPreps: [],
    resumeAnalyses: [],
  });
  const [selectedAnalysis, setSelectedAnalysis] = useState<{
    type: string;
    data: any;
  } | null>(null);

  useEffect(() => {
    if (resumeId) {
      fetchResumeAnalyses();
    } else {
      fetchAllAnalyses();
    }
  }, [resumeId, user?.id]);

  // Auto-select analysis from URL params
  useEffect(() => {
    const analysisType = searchParams.get("type");
    const analysisId = searchParams.get("id");

    if (analysisType && analysisId && !loading) {
      // Find the analysis in the fetched data
      const findAnalysis = () => {
        if (analysisType === "resumeAnalysis") {
          return analyses.resumeAnalyses.find((a: any) => a.id === analysisId);
        } else if (analysisType === "jobFit") {
          return analyses.jobFit.find((a: any) => a.id === analysisId);
        } else if (analysisType === "coverLetter") {
          return analyses.coverLetters.find((a: any) => a.id === analysisId);
        } else if (analysisType === "interviewPrep") {
          return analyses.interviewPreps.find((a: any) => a.id === analysisId);
        }
        return null;
      };

      const analysis = findAnalysis();
      if (analysis) {
        setSelectedAnalysis({ type: analysisType, data: analysis });
      }
    }
  }, [searchParams, analyses, loading]);

  const fetchResumeAnalyses = async () => {
    if (!resumeId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/resume/${resumeId}/analyses`);
      if (response.ok) {
        const data = await response.json();
        setAnalyses({
          jobFit: data.analyses.jobFit || [],
          coverLetters: data.analyses.coverLetters || [],
          interviewPreps: data.analyses.interviewPreps || [],
          resumeAnalyses: data.analyses.resumeAnalyses || [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch resume analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAnalyses = async () => {
    // For now, we'll fetch recent analyses from each table
    // In production, you might want a dedicated endpoint
    try {
      setLoading(true);
      const supabase = (await import("@/lib/supabase/client")).supabase;

      const [jobFitRes, coverLetterRes, interviewPrepRes, resumeAnalysisRes] =
        await Promise.all([
          supabase
            .from("job_fit_analysis")
            .select(
              `
              id,
              fit_score,
              analysis_result,
              created_at,
              user_resume_id,
              application_id,
              applications (company, role),
              user_resumes (name)
            `
            )
            .eq("user_id", user?.id)
            .order("created_at", { ascending: false })
            .limit(20),

          supabase
            .from("cover_letters")
            .select(
              `
              id,
              company_name,
              role_name,
              cover_letter,
              created_at,
              user_resume_id,
              user_resumes (name)
            `
            )
            .eq("user_id", user?.id)
            .order("created_at", { ascending: false })
            .limit(20),

          supabase
            .from("interview_prep")
            .select(
              `
              id,
              interview_context,
              prep_content,
              created_at,
              user_resume_id,
              user_resumes (name)
            `
            )
            .eq("user_id", user?.id)
            .order("created_at", { ascending: false })
            .limit(20),

          supabase
            .from("resume_analysis")
            .select(
              `
              id,
              analysis_text,
              created_at,
              user_resume_id,
              user_resumes (name)
            `
            )
            .eq("user_id", user?.id)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

      setAnalyses({
        jobFit: jobFitRes.data || [],
        coverLetters: coverLetterRes.data || [],
        interviewPreps: interviewPrepRes.data || [],
        resumeAnalyses: resumeAnalysisRes.data || [],
      });
    } catch (error) {
      console.error("Failed to fetch analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading analysis history...
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCount =
    analyses.jobFit.length +
    analyses.coverLetters.length +
    analyses.interviewPreps.length +
    analyses.resumeAnalyses.length;

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>
            Your past AI-generated analyses and documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No analysis history yet</p>
            <p className="text-sm mt-1">
              Start using AI Coach features to build your history
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {selectedAnalysis && (
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => setSelectedAnalysis(null)}
            className="mb-4"
          >
            ← Back to History
          </Button>

          {selectedAnalysis.type === "jobFit" && (
            <MarkdownOutputCard
              title="Job Fit Analysis"
              icon={<BarChart3 className="h-5 w-5" />}
              content={selectedAnalysis.data.analysis_result}
            />
          )}

          {selectedAnalysis.type === "coverLetter" && (
            <MarkdownOutputCard
              title={`Cover Letter - ${selectedAnalysis.data.company_name}`}
              icon={<FileText className="h-5 w-5" />}
              content={selectedAnalysis.data.cover_letter}
            />
          )}

          {selectedAnalysis.type === "interviewPrep" && (
            typeof selectedAnalysis.data.prep_content === 'string' ? (
              <MarkdownOutputCard
                title="Interview Preparation"
                icon={<MessageSquare className="h-5 w-5" />}
                content={selectedAnalysis.data.prep_content}
              />
            ) : (
              <InterviewPrepDisplay
                content={selectedAnalysis.data.prep_content}
                title="Interview Preparation"
                icon={<MessageSquare className="h-5 w-5" />}
              />
            )
          )}

          {selectedAnalysis.type === "resumeAnalysis" && (
            <MarkdownOutputCard
              title="Resume Analysis"
              icon={<Brain className="h-5 w-5" />}
              content={selectedAnalysis.data.analysis_text}
            />
          )}
        </div>
      )}

      {!selectedAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
            <CardDescription>
              View and revisit your past AI-generated analyses ({totalCount}{" "}
              total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">
                  All ({totalCount})
                </TabsTrigger>
                <TabsTrigger value="resume">
                  Resume ({analyses.resumeAnalyses.length})
                </TabsTrigger>
                <TabsTrigger value="jobfit">
                  Job Fit ({analyses.jobFit.length})
                </TabsTrigger>
                <TabsTrigger value="cover">
                  Cover ({analyses.coverLetters.length})
                </TabsTrigger>
                <TabsTrigger value="interview">
                  Interview ({analyses.interviewPreps.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3 mt-4">
                {[
                  ...analyses.resumeAnalyses.map((a: any) => ({
                    ...a,
                    type: "resumeAnalysis",
                  })),
                  ...analyses.jobFit.map((a: any) => ({ ...a, type: "jobFit" })),
                  ...analyses.coverLetters.map((a: any) => ({
                    ...a,
                    type: "coverLetter",
                  })),
                  ...analyses.interviewPreps.map((a: any) => ({
                    ...a,
                    type: "interviewPrep",
                  })),
                ]
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((item) => (
                    <AnalysisCard
                      key={`${item.type}-${item.id}`}
                      analysis={item}
                      onView={() =>
                        setSelectedAnalysis({ type: item.type, data: item })
                      }
                    />
                  ))}
              </TabsContent>

              <TabsContent value="resume" className="space-y-3 mt-4">
                {analyses.resumeAnalyses.map((analysis: any) => (
                  <AnalysisCard
                    key={analysis.id}
                    analysis={{ ...analysis, type: "resumeAnalysis" }}
                    onView={() =>
                      setSelectedAnalysis({
                        type: "resumeAnalysis",
                        data: analysis,
                      })
                    }
                  />
                ))}
              </TabsContent>

              <TabsContent value="jobfit" className="space-y-3 mt-4">
                {analyses.jobFit.map((analysis: any) => (
                  <AnalysisCard
                    key={analysis.id}
                    analysis={{ ...analysis, type: "jobFit" }}
                    onView={() =>
                      setSelectedAnalysis({ type: "jobFit", data: analysis })
                    }
                  />
                ))}
              </TabsContent>

              <TabsContent value="cover" className="space-y-3 mt-4">
                {analyses.coverLetters.map((analysis: any) => (
                  <AnalysisCard
                    key={analysis.id}
                    analysis={{ ...analysis, type: "coverLetter" }}
                    onView={() =>
                      setSelectedAnalysis({
                        type: "coverLetter",
                        data: analysis,
                      })
                    }
                  />
                ))}
              </TabsContent>

              <TabsContent value="interview" className="space-y-3 mt-4">
                {analyses.interviewPreps.map((analysis: any) => (
                  <AnalysisCard
                    key={analysis.id}
                    analysis={{ ...analysis, type: "interviewPrep" }}
                    onView={() =>
                      setSelectedAnalysis({
                        type: "interviewPrep",
                        data: analysis,
                      })
                    }
                  />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnalysisCard({
  analysis,
  onView,
}: {
  analysis: any;
  onView: () => void;
}) {
  const getIcon = () => {
    switch (analysis.type) {
      case "resumeAnalysis":
        return <Brain className="h-4 w-4" />;
      case "jobFit":
        return <BarChart3 className="h-4 w-4" />;
      case "coverLetter":
        return <FileText className="h-4 w-4" />;
      case "interviewPrep":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  const getTitle = () => {
    switch (analysis.type) {
      case "resumeAnalysis":
        return "Resume Analysis";
      case "jobFit":
        return analysis.applications
          ? `Job Fit - ${analysis.applications.company}`
          : "Job Fit Analysis";
      case "coverLetter":
        return `Cover Letter - ${analysis.company_name}`;
      case "interviewPrep":
        return analysis.interview_context || "Interview Preparation";
      default:
        return "Analysis";
    }
  };

  const getSubtitle = () => {
    if (analysis.type === "jobFit" && analysis.applications) {
      return analysis.applications.role;
    }
    if (analysis.type === "coverLetter") {
      return analysis.role_name;
    }
    if (analysis.user_resumes?.name) {
      return `Using: ${analysis.user_resumes.name}`;
    }
    return null;
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3 flex-1">
        <div className="p-2 bg-primary/10 rounded-lg">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{getTitle()}</h4>
            {analysis.fit_score && (
              <Badge variant="secondary" className="text-xs">
                {Math.round(analysis.fit_score)}% match
              </Badge>
            )}
          </div>
          {getSubtitle() && (
            <p className="text-sm text-muted-foreground truncate">
              {getSubtitle()}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(analysis.created_at), {
              addSuffix: true,
            })}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onView}>
        <Eye className="h-4 w-4 mr-2" />
        View
      </Button>
    </div>
  );
}
