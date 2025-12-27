"use client";

import { 
  Skull, 
  AlertTriangle, 
  Frown, 
  Meh, 
  ThumbsDown,
  Trash2,
  Flame,
  XCircle,
  AlertCircle,
  Ban
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ScoreType = 
  | "dead" 
  | "nauseous" 
  | "cringe" 
  | "boring"
  | "garbage"
  | "joke"
  | "fire"
  | "melting"
  | "cant-look"
  | "trash";

interface ScoreIconProps {
  score: ScoreType;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showLabel?: boolean;
  className?: string;
}

const scoreConfig = {
  dead: {
    icon: Skull,
    label: "Dead on Arrival",
    color: "text-gray-800",
    bgColor: "bg-gray-100",
  },
  nauseous: {
    icon: AlertCircle,
    label: "Makes Me Nauseous",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  cringe: {
    icon: Frown,
    label: "Pure Cringe",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  boring: {
    icon: Meh,
    label: "Cure for Insomnia",
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  garbage: {
    icon: ThumbsDown,
    label: "Absolute Garbage",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  joke: {
    icon: AlertTriangle,
    label: "Is This a Joke?",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  fire: {
    icon: Flame,
    label: "Dumpster Fire",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  melting: {
    icon: XCircle,
    label: "Secondhand Embarrassment",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  "cant-look": {
    icon: Ban,
    label: "Can't Bear to Look",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  trash: {
    icon: Trash2,
    label: "Straight to Trash",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
  },
};

export function ScoreIcon({ 
  score, 
  size = "md", 
  animated = false, 
  showLabel = false,
  className 
}: ScoreIconProps) {
  const sizeMap = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  const config = scoreConfig[score];
  const Icon = config.icon;

  if (showLabel) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(
          "rounded-full p-2",
          config.bgColor
        )}>
          <Icon className={cn(
            sizeMap[size],
            config.color,
            animated && "animate-pulse"
          )} />
        </div>
        <div>
          <span className="font-bold text-lg">/10</span>
          <p className="text-sm text-gray-600">{config.label}</p>
        </div>
      </div>
    );
  }

  return (
    <Icon className={cn(
      sizeMap[size],
      config.color,
      animated && "animate-pulse",
      className
    )} />
  );
}

// Export the mapping for use in other components
export function getScoreFromEmoji(emojiScore: string): ScoreType {
  // Map emoji scores to icon types
  if (emojiScore.includes("💀")) return "dead";
  if (emojiScore.includes("🤢")) return "nauseous";
  if (emojiScore.includes("😬")) return "cringe";
  if (emojiScore.includes("🥱")) return "boring";
  if (emojiScore.includes("💩")) return "garbage";
  if (emojiScore.includes("🤡")) return "joke";
  if (emojiScore.includes("🔥")) return "fire";
  if (emojiScore.includes("🫠")) return "melting";
  if (emojiScore.includes("🙈")) return "cant-look";
  if (emojiScore.includes("🗑️")) return "trash";
  
  // Default fallback
  return "fire";
}