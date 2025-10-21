"use client";

import { FileText, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ResumeAnalysisPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resume Analysis
        </h4>
        <Badge variant="secondary">AI Powered</Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold text-primary">85%</div>
          <div className="text-xs text-muted-foreground">ATS Score</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold text-orange-600">12</div>
          <div className="text-xs text-muted-foreground">Keywords Missing</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-2xl font-bold text-green-600">4.2/5</div>
          <div className="text-xs text-muted-foreground">Overall Rating</div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Strong action verbs</p>
            <p className="text-muted-foreground text-xs">Your experience section uses impactful language</p>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Missing key skills</p>
            <p className="text-muted-foreground text-xs">Add Python, AWS, and Docker to match job requirements</p>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Quantify achievements</p>
            <p className="text-muted-foreground text-xs">Add metrics to 3 bullet points for stronger impact</p>
          </div>
        </div>
      </div>
    </div>
  );
}