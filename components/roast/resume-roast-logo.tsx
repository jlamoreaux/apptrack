"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeRoastLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "card" | "hero";
  animated?: boolean;
}

export function ResumeRoastLogo({ 
  size = "md", 
  variant = "default",
  animated = false 
}: ResumeRoastLogoProps) {
  const sizeMap = {
    sm: { text: "text-xl", icon: "h-6 w-6", spacing: "gap-2" },
    md: { text: "text-3xl", icon: "h-8 w-8", spacing: "gap-3" },
    lg: { text: "text-5xl", icon: "h-12 w-12", spacing: "gap-4" },
    xl: { text: "text-7xl", icon: "h-16 w-16", spacing: "gap-6" },
  };

  const { text, icon, spacing } = sizeMap[size];

  if (variant === "hero") {
    return (
      <div className="relative">
        {/* Gradient background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 rounded-full blur-3xl opacity-20 animate-pulse" />
        
        {/* Main content */}
        <div className={`relative flex flex-col items-center justify-center ${spacing}`}>
          <div className={`flex items-center ${spacing}`}>
            <Flame className={cn(
              icon,
              "text-orange-500",
              animated && "animate-bounce"
            )} />
            <h1 className={`${text} font-bold bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 bg-clip-text text-transparent`}>
              Resume Roast
            </h1>
            <Flame className={cn(
              icon,
              "text-red-500",
              animated && "animate-bounce",
              animated && "[animation-delay:200ms]"
            )} />
          </div>
          
          <p className="text-lg text-gray-600 mt-2">Get brutally honest AI feedback</p>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="bg-gradient-to-r from-orange-50 via-red-50 to-purple-50 rounded-xl p-6 border border-orange-200">
        <div className={`flex items-center justify-center ${spacing}`}>
          <Flame className={cn(icon, "text-orange-500")} />
          <span className={`${text} font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent`}>
            Resume Roast
          </span>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`flex items-center ${spacing}`}>
      <Flame className={cn(
        icon,
        "text-orange-500",
        animated && "animate-pulse"
      )} />
      <span className={`${text} font-bold`}>Resume Roast</span>
    </div>
  );
}