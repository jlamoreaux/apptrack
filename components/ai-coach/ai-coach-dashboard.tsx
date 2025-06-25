"use client";

import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, MessageSquare, FileText, Target } from "lucide-react";
import { ResumeAnalyzer } from "./resume-analyzer";
import InterviewPrep from "./interview-prep";
import { CareerAdvice } from "./career-advice";
import CoverLetterGenerator from "./cover-letter-generator";
import { COPY } from "@/lib/content/copy";

interface AICoachDashboardProps {
  userId: string;
}

export function AICoachDashboard({ userId }: AICoachDashboardProps) {
  const [activeTab, setActiveTab] = useState("resume");
  const { features, tabs } = COPY.aiCoach.dashboard;

  return (
    <div className="space-y-8">
      {/* Feature Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
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
                  className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-3`}
                >
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
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
          <CareerAdvice userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
