"use client";

import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AIFeaturePreviewProps {
  children: React.ReactNode;
  className?: string;
}

export function AIFeaturePreview({ 
  children, 
  className 
}: AIFeaturePreviewProps) {
  return (
    <CardContent 
      className={cn(
        "p-6 opacity-50 pointer-events-none select-none",
        className
      )}
    >
      {children}
    </CardContent>
  );
}