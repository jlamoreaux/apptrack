import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_VARIANTS = {
  amber: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800",
  blue: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800",
  green: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800",
  orange: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800",
  indigo: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-800",
  purple: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-800",
} as const;

export type FeatureIconColor = keyof typeof COLOR_VARIANTS;

interface FeatureIconProps {
  icon: LucideIcon;
  color: FeatureIconColor;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
};

const ICON_SIZE_CLASSES = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function FeatureIcon({
  icon: Icon,
  color,
  className,
  size = "md",
}: FeatureIconProps) {
  return (
    <div
      className={cn(
        "rounded-lg border flex-shrink-0",
        SIZE_CLASSES[size],
        COLOR_VARIANTS[color],
        className
      )}
    >
      <Icon className={ICON_SIZE_CLASSES[size]} />
    </div>
  );
}

export { COLOR_VARIANTS as FEATURE_ICON_COLORS };
