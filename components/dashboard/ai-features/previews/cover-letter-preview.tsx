"use client";

import { FileText, Sparkles, Copy, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CoverLetterPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cover Letter Generator
        </h4>
        <Badge variant="secondary">AI Customized</Badge>
      </div>
      
      <div className="flex items-center justify-center py-3">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="font-semibold">Personalized for this role</span>
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Dear Hiring Manager,</p>
          
          <p>
            I am excited to apply for the [Position] role at [Company]. With my 
            background in [Your Experience], I am confident I can contribute to 
            your team's success...
          </p>
          
          <p>
            Your recent work on [Company Project] particularly resonates with my 
            experience in [Relevant Experience]. I successfully [Achievement] which 
            resulted in [Quantified Result]...
          </p>
          
          <p>
            I am particularly drawn to [Company] because of [Specific Reason]. My 
            skills in [Key Skills] align perfectly with your requirements...
          </p>
          
          <div className="text-center py-3 text-muted-foreground">
            <span className="text-xs">... Full letter continues ...</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          disabled
        >
          <Copy className="h-4 w-4 mr-1" />
          Copy
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          disabled
        >
          <Mail className="h-4 w-4 mr-1" />
          Email
        </Button>
      </div>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Tailored to job description • ATS optimized • Professional tone
        </p>
      </div>
    </div>
  );
}