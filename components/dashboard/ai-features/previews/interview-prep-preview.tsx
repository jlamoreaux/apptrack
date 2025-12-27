"use client";

import { MessageCircle, Star, Clock, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function InterviewPrepPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Interview Preparation
        </h4>
        <Badge variant="secondary">AI Generated</Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted rounded-lg text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
          <div className="text-lg font-semibold">15</div>
          <div className="text-xs text-muted-foreground">Practice Questions</div>
        </div>
        <div className="p-3 bg-muted rounded-lg text-center">
          <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
          <div className="text-lg font-semibold">STAR</div>
          <div className="text-xs text-muted-foreground">Answer Format</div>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium">Tell me about a time you led a challenging project</p>
            <Badge variant="outline" className="text-xs">Behavioral</Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3" />
              <span>Focus on: Leadership, problem-solving, results</span>
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium">How do you handle competing priorities?</p>
            <Badge variant="outline" className="text-xs">Situational</Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3" />
              <span>Highlight: Time management, communication</span>
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-3">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium">Why are you interested in our company?</p>
            <Badge variant="outline" className="text-xs">Company Fit</Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3" />
              <span>Research: Mission, values, recent news</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center text-xs text-muted-foreground">
        + 12 more tailored questions...
      </div>
    </div>
  );
}