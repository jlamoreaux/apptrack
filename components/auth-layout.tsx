import Link from "next/link";
import { CareerOtterMark } from "@/components/careerotter-mark";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile header */}
      <div className="lg:hidden bg-primary/5 border-b border-border px-4 py-3">
        <Link href="/" className="flex items-center gap-2 min-h-11">
          <CareerOtterMark decorative className="h-7 w-7" />
          <span className="font-semibold text-foreground">CareerOtter</span>
        </Link>
      </div>

      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] bg-section-cta text-section-cta-foreground flex-col justify-between p-10">
        <div>
          <Link href="/" className="flex items-center gap-2 min-h-11">
            <CareerOtterMark
              decorative
              className="h-8 w-8 text-section-cta-foreground"
            />
            <span className="text-xl font-bold text-section-cta-foreground">
              CareerOtter
            </span>
          </Link>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-display">
            Your companion for every stage of your career.
          </h2>
          <p className="text-section-cta-foreground/70 leading-relaxed">
            Land the job, log the wins, and make the case for what&apos;s next
            &mdash; CareerOtter is with you from first application to promotion.
          </p>
        </div>

        <p className="text-sm text-section-cta-foreground/70">
          Free forever &mdash; no credit card required
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-8 lg:py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
