"use client";

import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { CheckList } from "@/components/ui/check-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  FileText, 
  Target, 
  BarChart3, 
  MessageSquare,
  CheckCircle,
  ArrowRight 
} from "lucide-react";

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
    screenshot: "/screenshots/ai-coach/resume-analysis.png",
    color: "purple"
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
    screenshot: "/screenshots/ai-coach/job-fit.png",
    color: "blue"
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
    screenshot: "/screenshots/ai-coach/interview-prep.png",
    color: "green"
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
    screenshot: "/screenshots/ai-coach/cover-letter.png",
    color: "orange"
  }
];

export function HomeAICoachSection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 px-4 py-1 text-sm">AI Coach</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Your Personal AI Career Assistant
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stop guessing what recruiters want. Get instant, personalized feedback and content generation 
            powered by advanced AI that understands your career goals.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="space-y-20">
          {AI_FEATURES.map((feature, index) => {
            const isEven = index % 2 === 0;
            const colorClasses = {
              purple: "text-purple-600 bg-purple-50 border-purple-200",
              blue: "text-blue-600 bg-blue-50 border-blue-200",
              green: "text-green-600 bg-green-50 border-green-200",
              orange: "text-orange-600 bg-orange-50 border-orange-200"
            };
            const colors = colorClasses[feature.color as keyof typeof colorClasses];

            return (
              <div 
                key={feature.title} 
                className={`grid lg:grid-cols-2 gap-12 items-center ${isEven ? '' : 'lg:flex-row-reverse'}`}
              >
                {/* Content Side */}
                <div className={`space-y-6 ${isEven ? '' : 'lg:order-2'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${colors}`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold">{feature.title}</h3>
                  </div>
                  
                  <p className="text-lg text-muted-foreground">
                    {feature.description}
                  </p>
                  
                  <CheckList items={feature.highlights} />

                  <div className="pt-4">
                    <ButtonLink 
                      href="/signup" 
                      variant="outline"
                      className="gap-2"
                    >
                      Try {feature.title} Free
                      <ArrowRight className="h-4 w-4" />
                    </ButtonLink>
                  </div>
                </div>

                {/* Screenshot Side */}
                <div className={`relative ${isEven ? '' : 'lg:order-1'}`}>
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border bg-card">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />
                    <Image
                      src={feature.screenshot}
                      alt={`${feature.title} screenshot`}
                      width={800}
                      height={600}
                      className="w-full h-auto"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    />
                  </div>
                  <div className={`absolute -bottom-4 ${isEven ? '-right-4' : '-left-4'} bg-secondary/10 rounded-full p-8 -z-10`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <Card className="mt-20 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="p-8 sm:p-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to accelerate your job search?
            </h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of job seekers who are landing interviews faster with AI-powered assistance.
              Start with our free plan and upgrade when you need more power.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <ButtonLink href="/signup" size="lg" className="gap-2">
                Start Free with AI Coach
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/dashboard/ai-coach" variant="outline" size="lg">
                See Live Demo
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}