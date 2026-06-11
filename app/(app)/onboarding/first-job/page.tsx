import { FirstJobStep } from "@/components/onboarding/first-job-step";

/**
 * Guided first-job import step (retention Phase 1). New free-plan users are
 * routed here after plan selection to populate their pipeline before reaching
 * the dashboard.
 */
export default function FirstJobPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Let's track your first job
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Paste a job link and we'll fill in the details, or add one manually.
          </p>
        </div>
        <FirstJobStep />
      </div>
    </div>
  );
}
