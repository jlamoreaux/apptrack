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
import { API_ROUTES } from "@/lib/constants/api-routes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { COPY } from "@/lib/content/copy";

interface CareerAdviceProps {
  userId: string;
}

export function CareerAdvice({ userId }: CareerAdviceProps) {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const copy = COPY.aiCoach.careerAdvice;

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      setError(ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.MISSING_QUESTION);
      return;
    }

    setLoading(true);
    setError("");
    setAdvice("");

    try {
      const response = await fetch(API_ROUTES.AI_COACH.CAREER_ADVICE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          context: context.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.GENERATION_FAILED
        );
      }

      setAdvice(data.advice);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED);
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    "How do I negotiate salary for a new position?",
    "What skills should I focus on for career advancement?",
    "How do I transition to a different industry?",
    "What's the best way to network in my field?",
    "How do I handle a career gap in my resume?",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-600" />
            {copy.title}
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
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
            disabled={loading || !question.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
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
