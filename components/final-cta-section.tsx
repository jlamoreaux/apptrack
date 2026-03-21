import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ButtonLink } from "@/components/ui/button-link";

export function FinalCtaSection() {
  return (
    <section className="py-16 px-4 bg-section-cta text-section-cta-foreground">
      <div className="container mx-auto text-center max-w-2xl">
        <ScrollReveal>
          <h2 className="text-3xl lg:text-4xl font-bold font-display mb-4">
            Ready to take control of your job search?
          </h2>
          <p className="text-lg text-section-cta-muted mb-8">
            Start free. Upgrade anytime. We&apos;ll remind you to cancel when
            you&apos;re hired.
          </p>
          <ButtonLink
            href="/signup"
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-lg"
          >
            Start Free — See Your Pipeline
          </ButtonLink>
        </ScrollReveal>
      </div>
    </section>
  );
}
