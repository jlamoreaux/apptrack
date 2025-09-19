"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AICoachDataProvider } from "@/contexts/ai-coach-data-context";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  MessageSquare,
  FileText,
  Target,
  Upload,
  Sparkles,
  BarChart3,
  Clock,
} from "lucide-react";
import { ResumeAnalyzer } from "./resume-analyzer";
import InterviewPrep from "./interview-prep";
import { CareerAdvice } from "./career-advice";
import CoverLetterGenerator from "./cover-letter-generator";
import { JobFitAnalysis } from "./job-fit-analysis";
import { ResumeSection } from "@/components/resume-section";
import { RecentActivity } from "./recent-activity";
import { COPY } from "@/lib/content/copy";
import { Badge } from "@/components/ui/badge";
import { OnboardingFlow } from "./onboarding-flow";

interface AICoachDashboardProps {
  userId: string;
}

function AICoachDashboardInner({ userId }: AICoachDashboardProps) {
  const [isNewUser, setIsNewUser] = useState(false);
  const [activeTab, setActiveTab] = useState("resume");
  const searchParams = useSearchParams();
  const { tabs } = COPY.aiCoach.dashboard;

  // Valid tab values
  const validTabs = ["resume", "interview", "cover-letter", "advice", "job-fit"];

  useEffect(() => {
    // Read tab parameter from URL
    const tabParam = searchParams.get("tab");
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Get applicationId from URL for passing to components that need it
  const applicationId = searchParams.get("applicationId");

  // Check if user is new (would be determined by checking if they have any AI usage history)
  // For now, we'll just show onboarding if they haven't dismissed it

  return (
    <div className="space-y-8">
      {/* Onboarding for new users */}
      {isNewUser && (
        <OnboardingFlow onComplete={() => setIsNewUser(false)} />
      )}

      {/* Resume Section */}
      <ResumeSection />

      {/* Recent Activity - Removed Usage Display as it's in settings */}
      <RecentActivity userId={userId} />

      {/* Main Content - Streamlined tabs interface */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-3 sm:flex sm:flex-wrap md:grid md:grid-cols-5 w-full h-auto p-1 gap-1">
          <TabsTrigger value="resume" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:py-2 min-w-[60px] sm:min-w-[80px]">
            <Brain className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center">Resume</span>
          </TabsTrigger>
          <TabsTrigger value="interview" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:py-2 min-w-[60px] sm:min-w-[80px]">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center">Interview</span>
          </TabsTrigger>
          <TabsTrigger value="cover-letter" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:py-2 min-w-[60px] sm:min-w-[80px]">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center">Cover</span>
          </TabsTrigger>
          <TabsTrigger value="advice" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:py-2 min-w-[60px] sm:min-w-[80px]">
            <Target className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center">Advice</span>
          </TabsTrigger>
          <TabsTrigger value="job-fit" className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 sm:py-2 min-w-[60px] sm:min-w-[80px] col-start-2 sm:col-start-auto">
            <BarChart3 className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center">Job Fit</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-6">
          <ResumeAnalyzer userId={userId} />
        </TabsContent>

        <TabsContent value="interview" className="space-y-6">
          <InterviewPrep applicationId={applicationId || undefined} />
        </TabsContent>

        <TabsContent value="cover-letter" className="space-y-6">
          <CoverLetterGenerator />
        </TabsContent>

        <TabsContent value="advice" className="space-y-6">
          <CareerAdvice />
        </TabsContent>

        <TabsContent value="job-fit" className="space-y-6">
          <JobFitAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function AICoachDashboard({ userId }: AICoachDashboardProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "resume";
  
  return (
    <AICoachDataProvider initialTab={initialTab}>
      <AICoachDashboardInner userId={userId} />
    </AICoachDataProvider>
  );
}
