import { BarChart3, FileText, MessageSquare, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "job-fit" | "cover-letter" | "interview-prep";

interface SampleResultPreviewProps {
  variant: Variant;
  className?: string;
}

const PREVIEWS: Record<
  Variant,
  { icon: React.ElementType; title: string; bullets: string[] }
> = {
  "job-fit": {
    icon: BarChart3,
    title: "What you'll get",
    bullets: [
      "Match score with breakdown",
      "Skills and experience analysis",
      "Improvement suggestions",
      "Missing keywords",
    ],
  },
  "cover-letter": {
    icon: FileText,
    title: "What you'll get",
    bullets: [
      "Tailored to the job description",
      "Professional tone",
      "Highlights relevant experience",
      "Ready to send",
    ],
  },
  "interview-prep": {
    icon: MessageSquare,
    title: "What you'll get",
    bullets: [
      "Role-specific questions",
      "STAR format guidance",
      "Based on the job description",
      "Follow-up tips",
    ],
  },
};

export function SampleResultPreview({
  variant,
  className,
}: SampleResultPreviewProps) {
  const preview = PREVIEWS[variant];
  const Icon = preview.icon;

  return (
    <div
      className={cn(
        "bg-badge-indigo/50 rounded-lg px-5 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">
          {preview.title}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {preview.bullets.map((bullet) => (
          <span
            key={bullet}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            {bullet}
          </span>
        ))}
      </div>
    </div>
  );
}
