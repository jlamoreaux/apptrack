"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface InterviewContextCardProps {
  interviewContext: string;
  onInterviewContextChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export const InterviewContextCard = ({
  interviewContext,
  onInterviewContextChange,
  label = "Interview Context",
  placeholder = "Add any specific details about the interview type, format, or focus areas...",
}: InterviewContextCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Additional Context</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="interviewContext">{label}</Label>
          <Textarea
            id="interviewContext"
            placeholder={placeholder}
            value={interviewContext}
            onChange={(e) => onInterviewContextChange(e.target.value)}
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};