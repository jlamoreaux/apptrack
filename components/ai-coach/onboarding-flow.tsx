"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, Sparkles, Upload, Brain, MessageSquare, FileText, Target, BarChart3, ArrowRight } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface Step {
  id: number;
  title: string;
  description: string;
  icon: any;
  action?: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Welcome to AI Coach!",
    description: "Your AI-powered career assistant is ready to help you land your dream job.",
    icon: Sparkles,
  },
  {
    id: 2,
    title: "Upload Your Resume",
    description: "Start by uploading your resume. This helps us provide personalized recommendations.",
    icon: Upload,
    action: "Upload Resume",
  },
  {
    id: 3,
    title: "AI-Powered Features",
    description: "Explore our suite of AI tools designed to accelerate your job search.",
    icon: Brain,
  },
  {
    id: 4,
    title: "Track Your Usage",
    description: "Monitor your AI feature usage and stay within your subscription limits.",
    icon: BarChart3,
  },
];

const features = [
  {
    icon: Brain,
    title: "Resume Analysis",
    description: "Get detailed feedback on your resume",
  },
  {
    icon: MessageSquare,
    title: "Interview Prep",
    description: "Practice with tailored interview questions",
  },
  {
    icon: FileText,
    title: "Cover Letters",
    description: "Generate customized cover letters",
  },
  {
    icon: Target,
    title: "Career Advice",
    description: "Get personalized career guidance",
  },
  {
    icon: BarChart3,
    title: "Job Fit Analysis",
    description: "See how well you match job requirements",
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Step {currentStep + 1} of {steps.length}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip Tour
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent>
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <Icon className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h3 className="text-2xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">{step.description}</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleNext} size="lg">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">{step.description}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Your resume helps us provide personalized AI recommendations
              </p>
              <Button variant="outline" asChild>
                <Link href="/dashboard/ai-coach">Upload Later</Link>
              </Button>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                Back
              </Button>
              <Button onClick={handleNext}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">{step.description}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {features.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <div key={feature.title} className="text-center p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <FeatureIcon className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                Back
              </Button>
              <Button onClick={handleNext}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">{step.description}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Daily Limits</span>
                  <span className="text-sm text-muted-foreground">Resets every 24 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Hourly Limits</span>
                  <span className="text-sm text-muted-foreground">Prevents burst usage</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Usage Display</span>
                  <span className="text-sm text-muted-foreground">Track your progress</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                Back
              </Button>
              <Button onClick={handleNext}>
                Start Using AI Coach
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}