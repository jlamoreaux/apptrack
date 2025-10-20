"use client";

import { TestimonialCard } from "./testimonial-card";
import { Badge } from "@/components/ui/badge";
import { AI_THEME } from "@/lib/constants/ai-theme";

// Placeholder testimonials - replace with real user testimonials when available
const testimonials = [
  {
    id: 1,
    name: "User Name",
    role: "Job Title",
    company: "Company Name",
    content: "Share how AppTrack helped you in your job search journey. Did the AI features save you time? Help you land more interviews? We'd love to hear your story!",
    highlight: "Your success metric here",
    rating: 5,
  },
  {
    id: 2,
    name: "User Name",
    role: "Job Title",
    content: "Tell us about your experience with AI-powered features. How did the resume analysis, cover letter generation, or interview prep help you?",
    highlight: "Your key achievement",
    rating: 5,
  },
  {
    id: 3,
    name: "User Name",
    role: "Job Title",
    company: "Company Name",
    content: "What specific feature made the biggest difference in your job search? Share your results and help others succeed too!",
    highlight: "Your breakthrough moment",
    rating: 5,
  },
  {
    id: 4,
    name: "User Name",
    role: "Job Title",
    content: "How did tracking your applications with AppTrack change your job search? What insights did you gain from the analytics?",
    highlight: "Your improvement metric",
    rating: 5,
  },
  {
    id: 5,
    name: "User Name",
    role: "Job Title",
    company: "Company Name",
    content: "Would you recommend AppTrack to other job seekers? What would you tell them about your experience?",
    highlight: "Your recommendation",
    rating: 5,
  },
  {
    id: 6,
    name: "User Name",
    role: "Job Title",
    content: "Share your before and after story. How was your job search different after using AppTrack's AI Career Coach?",
    highlight: "Your transformation",
    rating: 5,
  },
];

export function TestimonialSection() {
  return (
    <section className="py-16 px-4 bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <Badge className={AI_THEME.getBadgeClasses("subtle") + " mb-4"}>
            Coming Soon
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Be Part of Our Success Stories
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're collecting testimonials from our early users. Your success story could be featured here!
          </p>
        </div>

        {/* Testimonial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.id}
              {...testimonial}
            />
          ))}
        </div>
      </div>
    </section>
  );
}