import { Quote } from "lucide-react"
import { COPY } from "@/lib/content/copy"

export function HomeSocialProof() {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12">
          {COPY.socialProof.title}
        </h2>
        
        {/* Testimonials */}
        {COPY.socialProof.testimonials.length > 0 && (
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {COPY.socialProof.testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="bg-background rounded-lg p-6 shadow-sm border"
              >
                <Quote className="h-8 w-8 text-primary/20 mb-4" />
                <p className="text-foreground mb-4 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-semibold text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {COPY.socialProof.stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}