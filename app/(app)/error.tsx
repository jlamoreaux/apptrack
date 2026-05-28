"use client";

import { SupportErrorFallback } from "@/components/support/support-error-fallback";

interface AppSegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppSegmentError({ error, reset }: AppSegmentErrorProps) {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <SupportErrorFallback name="this page" error={error} reset={reset} />
      </div>
    </div>
  );
}
