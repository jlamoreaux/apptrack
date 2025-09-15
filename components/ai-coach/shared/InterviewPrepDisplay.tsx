"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, Target, Lightbulb, Building, User } from "lucide-react";
import type { InterviewPreparationResult, InterviewQuestion } from "@/types/ai-analysis";

interface InterviewPrepDisplayProps {
  content: InterviewPreparationResult;
  title?: string;
  icon?: React.ReactNode;
}

const getDifficultyColor = (difficulty: InterviewQuestion['difficulty']) => {
  switch (difficulty) {
    case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getCategoryIcon = (category: InterviewQuestion['category']) => {
  switch (category) {
    case 'behavioral': return <User className="h-4 w-4" />;
    case 'technical': return <Target className="h-4 w-4" />;
    case 'company-specific': return <Building className="h-4 w-4" />;
    case 'role-specific': return <MessageSquare className="h-4 w-4" />;
    case 'situational': return <Lightbulb className="h-4 w-4" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
};

const QuestionCard: React.FC<{ question: InterviewQuestion; index: number }> = ({ question, index }) => {
  // Add safety checks for required properties
  if (!question || !question.question) {
    console.warn('Invalid question object:', question);
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {getCategoryIcon(question.category || 'behavioral')}
            Question {index + 1}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {(question.category || 'behavioral').replace('-', ' ')}
            </Badge>
            <Badge className={`text-xs ${getDifficultyColor(question.difficulty || 'medium')}`}>
              {question.difficulty || 'medium'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="font-medium text-sm mb-2">Question:</h4>
          <p className="text-sm bg-muted p-3 rounded-md">{question.question}</p>
        </div>
        
        <div>
          <h4 className="font-medium text-sm mb-2">Suggested Approach:</h4>
          <p className="text-sm text-muted-foreground">
            {question.suggestedApproach || 'Structure your response clearly and provide specific examples when possible.'}
          </p>
        </div>

        {question.starFramework && (
          <div>
            <h4 className="font-medium text-sm mb-2">STAR Framework Example:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <strong className="text-xs text-blue-600 dark:text-blue-400">Situation:</strong>
                <p className="text-xs text-muted-foreground mt-1">{question.starFramework.situation}</p>
              </div>
              <div>
                <strong className="text-xs text-green-600 dark:text-green-400">Task:</strong>
                <p className="text-xs text-muted-foreground mt-1">{question.starFramework.task}</p>
              </div>
              <div>
                <strong className="text-xs text-orange-600 dark:text-orange-400">Action:</strong>
                <p className="text-xs text-muted-foreground mt-1">{question.starFramework.action}</p>
              </div>
              <div>
                <strong className="text-xs text-purple-600 dark:text-purple-400">Result:</strong>
                <p className="text-xs text-muted-foreground mt-1">{question.starFramework.result}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const InterviewPrepDisplay: React.FC<InterviewPrepDisplayProps> = ({
  content,
  title = "Interview Preparation",
  icon = <MessageSquare className="h-5 w-5" />
}) => {
  // Content is always structured now
  const prep = content;
  
  // Debug: Log the questions to console and check for duplicate IDs
  console.log('Total questions received:', prep.questions.length);
  console.log('Questions data:', prep.questions);
  
  // Check for duplicate IDs
  const questionIds = prep.questions.map(q => q.id).filter(Boolean);
  const uniqueIds = new Set(questionIds);
  if (questionIds.length !== uniqueIds.size) {
    console.warn('Duplicate question IDs detected:', questionIds);
  }
  
  return (
    <div className="space-y-6" data-interview-prep-display>
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              ~{prep.estimatedDuration} minutes
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {prep.questions.length} questions
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Questions */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Interview Questions
        </h3>
        {prep.questions.map((question, index) => {
          // Generate a truly unique key by combining ID with index to handle duplicates
          const key = question.id ? `${question.id}-${index}` : `fallback-${index}`;
          return (
            <QuestionCard key={key} question={question} index={index} />
          );
        })}
      </div>

      {/* Additional Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {prep.generalTips.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                General Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prep.generalTips.map((tip, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {prep.companyInsights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4" />
                Company Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prep.companyInsights.map((insight, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {prep.roleSpecificAdvice.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Role-Specific Advice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prep.roleSpecificAdvice.map((advice, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{advice}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {prep.practiceAreas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Practice Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prep.practiceAreas.map((area, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};