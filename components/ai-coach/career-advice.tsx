"use client";

import { useState } from "react";
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
import { Target, Sparkles, AlertCircle, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";
import { useAICoachClient } from "@/hooks/use-ai-coach-client";
import { useResumesClient } from "@/hooks/use-resumes-client";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { generateCareerAdvice } from "@/lib/ai-coach/functions";

interface CareerAdviceProps {
  userId: string;
}

export function CareerAdvice({ userId }: CareerAdviceProps) {
  const { user } = useSupabaseAuth();
  const {
    createCareerAdvice,
    loading: dalLoading,
    error,
    clearError,
  } = useAICoachClient(user?.id || null);
  const { getResumeText, loading: resumeLoading } = useResumesClient(
    user?.id || null
  );
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [advice, setAdvice] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const copy = COPY.aiCoach.careerAdvice;

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      clearError();
      return;
    }

    setLocalLoading(true);
    clearError();
    setAdvice("");

    try {
      // Get user's resume text for context
      const resumeText = await getResumeText();

      // Generate advice using AI with resume context
      const generatedAdvice = await generateCareerAdvice(
        question.trim(),
        context.trim() || undefined,
        resumeText || undefined
      );

      // Save to database
      const result = await createCareerAdvice(question.trim(), generatedAdvice);

      if (result) {
        setAdvice(result.advice);
      } else {
        setAdvice(generatedAdvice);
      }
    } catch (err) {
      // Error is handled by the hook
    } finally {
      setLocalLoading(false);
    }
  };

  const sampleQuestions = [
    "How do I negotiate salary for a new position?",
    "What skills should I focus on for career advancement?",
    "How do I transition to a different industry?",
    "What's the best way to network in my field?",
    "How do I handle a career gap in my resume?",
  ];

  const isLoading = dalLoading || localLoading || resumeLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-600" />
            {copy.title}
          </CardTitle>
          <CardDescription>
            {copy.description}
            {resumeLoading
              ? " Loading your resume for personalized advice..."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="question">{copy.questionLabel}</Label>
            <Textarea
              id="question"
              placeholder={copy.questionPlaceholder}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">{copy.contextLabel}</Label>
            <Textarea
              id="context"
              placeholder={copy.contextPlaceholder}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Sample Questions */}
          <div className="space-y-2">
            <Label>{copy.sampleQuestionsLabel}</Label>
            <div className="flex flex-wrap gap-2">
              {copy.sampleQuestions.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(sample)}
                  className="text-xs"
                >
                  {sample}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAskQuestion}
            disabled={isLoading || !question.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                {copy.getAdviceButton.loading}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {copy.getAdviceButton.default}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {advice && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-600" />
              {copy.adviceTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {advice}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
