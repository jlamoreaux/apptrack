import { COPY } from "./copy"
import { Target, Brain, BarChart3, Users } from "lucide-react"

// Icon mapping (technical concern)
const ICON_MAP = {
  Target,
  Brain,
  BarChart3,
  Users,
} as const

export const getFeatures = () => {
  return COPY.features.core.map((feature) => ({
    ...feature,
    IconComponent: ICON_MAP[feature.icon as keyof typeof ICON_MAP],
  }))
}

export type Feature = ReturnType<typeof getFeatures>[0]
