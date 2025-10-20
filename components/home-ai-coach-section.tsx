"use client";

import { ButtonLink } from "@/components/ui/button-link";
import { CheckList } from "@/components/ui/check-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Brain, 
  FileText, 
  Target, 
  MessageSquare,
  ArrowRight 
} from "lucide-react";
import { AI_THEME, AI_FEATURE_COLORS } from "@/lib/constants/ai-theme";

const AI_FEATURES = [
  {
    icon: Brain,
    title: "Resume Analysis",
    description: "Get instant AI feedback on your resume with specific suggestions for improvement",
    highlights: [
      "ATS optimization tips",
      "Keyword analysis",
      "Format recommendations",
      "Achievement quantification"
    ],
    color: "amber" as const
  },
  {
    icon: Target,
    title: "Job Fit Analysis",
    description: "See how well your profile matches any job posting with detailed gap analysis",
    highlights: [
      "Skills match percentage",
      "Experience alignment",
      "Missing qualifications",
      "Actionable next steps"
    ],
    color: "blue" as const
  },
  {
    icon: MessageSquare,
    title: "Interview Preparation",
    description: "Practice with AI-generated questions tailored to your specific role and company",
    highlights: [
      "Role-specific questions",
      "STAR format guidance",
      "Company research tips",
      "Questions to ask"
    ],
    color: "green" as const
  },
  {
    icon: FileText,
    title: "Cover Letter Generator",
    description: "Create compelling, customized cover letters in seconds for each application",
    highlights: [
      "Personalized to job description",
      "Professional formatting",
      "Keyword optimization",
      "Edit and customize"
    ],
    color: "orange" as const
  }
] as const;

export function HomeAICoachSection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Your Personal AI Career Assistant
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stop guessing what recruiters want. Get instant, personalized feedback and content generation 
            powered by advanced AI that understands your career goals.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-24">
          {AI_FEATURES.map((feature) => {
            const colorClasses = {
              amber: `${AI_THEME.classes.iconContainer.default} ${AI_THEME.classes.iconContainer.bordered}`,
              blue: "text-blue-600 bg-blue-50 border-blue-200",
              green: "text-green-600 bg-green-50 border-green-200",
              orange: "text-orange-600 bg-orange-50 border-orange-200"
            };
            const colors = colorClasses[feature.color];

            return (
              <Card key={feature.title} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${colors} flex-shrink-0`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CheckList items={feature.highlights} className="text-sm" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <Card className="max-w-5xl mx-auto mt-16 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="p-8 sm:p-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to accelerate your job search?
            </h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Land interviews faster with AI-powered assistance.
              Upgrade to AI Coach for advanced career coaching features.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <ButtonLink href="/signup" size="lg" className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#pricing" variant="outline" size="lg">
                View Pricing
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}