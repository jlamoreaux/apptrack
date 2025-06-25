"use client";

import { useState } from "react";
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
} from "lucide-react";
import { ResumeAnalyzer } from "./resume-analyzer";
import InterviewPrep from "./interview-prep";
import { CareerAdvice } from "./career-advice";
import CoverLetterGenerator from "./cover-letter-generator";
import { ResumeSection } from "@/components/resume-section";
import { COPY } from "@/lib/content/copy";
import { Badge } from "@/components/ui/badge";

interface AICoachDashboardProps {
  userId: string;
}

export function AICoachDashboard({ userId }: AICoachDashboardProps) {
  const [activeTab, setActiveTab] = useState("resume");
  const { features, tabs } = COPY.aiCoach.dashboard;

  return (
    <div className="space-y-8">
      {/* Resume Section */}
      <ResumeSection />

      {/* Feature Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          const isComingSoon =
            feature.id === "cover-letter" || feature.id === "advice";
          return (
            <Card
              key={feature.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                activeTab === feature.id
                  ? `${feature.borderColor} ring-2 ring-opacity-20`
                  : ""
              }`}
              onClick={() => setActiveTab(feature.id)}
            >
              <CardHeader className="pb-3">
                <div
                  className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-3 relative`}
                >
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                {isComingSoon && (
                  <Badge
                    variant="secondary"
                    className="text-xs w-36 px-2 py-0.5 mr-3 justify-around"
                  >
                    Coming Soon
                    <Sparkles className="h-6 w-6 text-green-600 animate-pulse drop-shadow-lg" />
                  </Badge>
                )}
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="resume" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {tabs.resume}
          </TabsTrigger>
          <TabsTrigger value="interview" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {tabs.interview}
          </TabsTrigger>
          <TabsTrigger value="cover-letter" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {tabs.coverLetter}
          </TabsTrigger>
          <TabsTrigger value="advice" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {tabs.advice}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-6">
          <ResumeAnalyzer userId={userId} />
        </TabsContent>

        <TabsContent value="interview" className="space-y-6">
          <InterviewPrep />
        </TabsContent>

        <TabsContent value="cover-letter" className="space-y-6">
          <CoverLetterGenerator />
        </TabsContent>

        <TabsContent value="advice" className="space-y-6">
          <CareerAdvice />
        </TabsContent>
      </Tabs>
    </div>
  );
}
