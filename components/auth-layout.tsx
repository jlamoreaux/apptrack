import Link from "next/link";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile header */}
      <div className="lg:hidden bg-primary/5 border-b border-border px-4 py-3">
        <Link href="/" className="flex items-center gap-2 min-h-11">
          <Image
            src="/logo_square.png"
            alt="AppTrack Logo"
            width={28}
            height={28}
            className="rounded"
          />
          <span className="font-semibold text-foreground">AppTrack</span>
        </Link>
      </div>

      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] bg-section-cta text-section-cta-foreground flex-col justify-between p-10">
        <div>
          <Link href="/" className="flex items-center gap-2 min-h-11">
            <Image
              src="/logo_square.png"
              alt="AppTrack Logo"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="text-xl font-bold text-section-cta-foreground">
              AppTrack
            </span>
          </Link>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-display">
            Track your applications. Visualize your pipeline. Land the role.
          </h2>
          <p className="text-section-cta-foreground/70 leading-relaxed">
            One place to organize your job search with AI-powered resume analysis, cover letters, and interview prep.
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
