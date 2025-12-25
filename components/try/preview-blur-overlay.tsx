"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";

interface PreviewBlurOverlayProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function PreviewBlurOverlay({
  children,
  title = "Sign up to unlock full content",
  description = "Create a free account to see everything",
}: PreviewBlurOverlayProps) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Blurred content underneath */}
      <div
        className="select-none pointer-events-none opacity-50"
        style={{ filter: "blur(14px)" }}
      >
        {children}
      </div>
      {/* Dark overlay with centered lock */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 dark:bg-black/70">
        <div className="text-center max-w-md px-6 py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h4 className="text-xl font-semibold mb-2 text-white">{title}</h4>
          <p className="text-sm text-white/70">{description}</p>
        </div>
      </div>
    </div>
  );
}
