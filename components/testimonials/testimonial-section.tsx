"use client";

import { TestimonialCard } from "./testimonial-card";
import { Badge } from "@/components/ui/badge";
import { AI_THEME } from "@/lib/constants/ai-theme";
import { useFeatureFlag, FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag";
import { COPY } from "@/lib/content/copy";

export function TestimonialSection() {
  // const showTestimonials = useFeatureFlag(FEATURE_FLAGS.SHOW_TESTIMONIALS);

  // Temporarily disabled feature flag check for preview
  // if (!showTestimonials) {
  //   return null;
  // }

  const testimonialCopy = COPY.testimonials || {
    badge: "Coming Soon",
    title: "Be Part of Our Success Stories",
    subtitle: "We're collecting testimonials from our early users.",
    placeholders: []
  };

  const testimonials = testimonialCopy.placeholders.map((testimonial: any, index: number) => ({
    ...testimonial,
    id: index + 1,
  }));
  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <Badge className={AI_THEME.getBadgeClasses("subtle") + " mb-4"}>
            {testimonialCopy.badge}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {testimonialCopy.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {testimonialCopy.subtitle}
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