"use client";

import { Target, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function JobFitPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" />
          Job Fit Analysis
        </h4>
        <Badge variant="secondary">AI Match Score</Badge>
      </div>
      
      <div className="text-center py-4">
        <div className="relative inline-flex items-center justify-center">
          <div className="text-5xl font-bold text-primary">78%</div>
          <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-6" />
        </div>
        <p className="text-sm text-muted-foreground mt-2">Strong Match</p>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Technical Skills</span>
            <span className="text-muted-foreground">85%</span>
          </div>
          <Progress value={85} className="h-2" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Experience Level</span>
            <span className="text-muted-foreground">70%</span>
          </div>
          <Progress value={70} className="h-2" />
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Cultural Fit</span>
            <span className="text-muted-foreground">90%</span>
          </div>
          <Progress value={90} className="h-2" />
        </div>
      </div>
      
      <div className="border-t pt-3">
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="font-medium">Key Strengths:</span>
        </div>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground ml-6">
          <li>• Strong technical background matches requirements</li>
          <li>• Relevant industry experience</li>
          <li>• Leadership skills align with role</li>
        </ul>
        
        <div className="flex items-center gap-2 text-sm mt-3">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <span className="font-medium">Areas to Address:</span>
        </div>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground ml-6">
          <li>• Consider highlighting cloud experience</li>
          <li>• Emphasize team collaboration skills</li>
        </ul>
      </div>
    </div>
  );
}