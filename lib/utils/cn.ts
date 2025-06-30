import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function that combines clsx and tailwind-merge
 * for optimal Tailwind CSS class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}