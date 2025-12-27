import { ButtonLink } from "@/components/ui/button-link"
import { COPY } from "@/lib/content/copy"

export function HomeFinalCta() {
  return (
    <section className="py-16 px-4 bg-muted">
      <div className="container mx-auto max-w-3xl text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
          {COPY.finalCta.title}
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          {COPY.finalCta.subtitle}
        </p>
        
        <ButtonLink 
          href={COPY.finalCta.cta.href} 
          size="lg" 
          className="bg-secondary hover:bg-secondary/90 text-white mb-4"
        >
          {COPY.finalCta.cta.text}
        </ButtonLink>
        
        <p className="text-sm text-muted-foreground">
          {COPY.finalCta.supportingText}
        </p>
      </div>
    </section>
  )
}