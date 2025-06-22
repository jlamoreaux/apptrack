import copyData from "@/content/copy.json"

// Type-safe access to copy with validation
export const COPY = copyData

// Helper functions for copy access
export const getCopy = (path: string) => {
  return path.split(".").reduce((obj, key) => obj?.[key], COPY)
}

// Validate copy structure at build time
export const validateCopy = () => {
  const required = ["hero.title", "hero.subtitle", "pricing.title"]
  for (const path of required) {
    if (!getCopy(path)) {
      throw new Error(`Missing required copy: ${path}`)
    }
  }
}
