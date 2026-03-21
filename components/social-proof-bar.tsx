import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface StatItemProps {
  value: string;
  label: string;
}

function StatItem({ value, label }: StatItemProps) {
  return (
    <div className="text-center px-2">
      <div className="text-lg font-semibold font-display text-foreground">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Divider() {
  return (
    <div className="hidden md:block w-px h-8 bg-border" aria-hidden="true" />
  );
}

export function SocialProofBar() {
  return (
    <section className="py-6 border-y border-border bg-surface-1">
      <ScrollReveal>
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-6 md:gap-8">
          <StatItem value="Free forever" label="plan available" />
          <Divider />
          <StatItem value="$9/mo" label="AI career coaching" />
          <Divider />
          <StatItem value="One click" label="browser extension" />
          <Divider />
          <StatItem value="Cancel reminder" label="when you're hired" />
        </div>
      </ScrollReveal>
    </section>
  );
}
