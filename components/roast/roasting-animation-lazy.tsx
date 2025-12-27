"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Lazy load the animation component
export const RoastingAnimationLazy = dynamic(
  () => import("./roasting-animation").then(mod => ({ default: mod.RoastingAnimation })),
  {
    loading: () => (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Preparing to roast...</p>
        </div>
      </div>
    ),
    ssr: false // Don't SSR the animation component
  }
);