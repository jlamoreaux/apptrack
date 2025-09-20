import { X, Check } from "lucide-react"
import { COPY } from "@/lib/content/copy"

export function HomeProblemSolution() {
  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12">
          {COPY.problemSolution.title}
        </h2>
        
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4 text-destructive">The Problem</h3>
            <div className="space-y-3">
              {COPY.problemSolution.problems.map((problem) => (
                <div key={problem} className="flex items-start gap-3">
                  <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{problem}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4 text-primary">The Solution</h3>
            <div className="space-y-3">
              {COPY.problemSolution.solutions.map((solution) => (
                <div key={solution} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{solution}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}