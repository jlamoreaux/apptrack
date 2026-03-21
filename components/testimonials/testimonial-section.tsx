"use client";

import { TestimonialCard } from "./testimonial-card";
import { Badge } from "@/components/ui/badge";
import { COPY } from "@/lib/content/copy";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ui/scroll-reveal";

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

  const avatarGradients = [
    "from-indigo-500 to-violet-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
  ];

  const testimonials = testimonialCopy.placeholders.map((testimonial: any, index: number) => ({
    ...testimonial,
    id: index + 1,
    avatarGradient: avatarGradients[index % avatarGradients.length],
  }));
  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        {/* Section Header */}
        <ScrollReveal>
          <div className="text-center mb-12">
            <Badge className="bg-badge-indigo text-badge-indigo-fg border-badge-indigo mb-4">
              {testimonialCopy.badge}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              {testimonialCopy.title}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {testimonialCopy.subtitle}
            </p>
          </div>
        </ScrollReveal>

        {/* Testimonial Grid */}
        <StaggerContainer staggerDelay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {testimonials.map((testimonial) => (
              <StaggerItem key={testimonial.id}>
                <TestimonialCard
                  {...testimonial}
                />
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>
      </div>
    </section>
  );
}