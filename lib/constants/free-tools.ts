import { FileText, Target, MessageSquare, Flame, LucideIcon } from "lucide-react"
import { FeatureIconColor } from "@/components/ui/feature-icon"

export interface FreeTool {
  title: string
  description: string
  shortDescription: string
  href: string
  icon: LucideIcon
  iconColor: FeatureIconColor
  features: string[]
}

export const FREE_TOOLS: FreeTool[] = [
  {
    title: "AI Cover Letter Generator",
    description: "Generate a personalized, professional cover letter tailored to any job description in 30 seconds.",
    shortDescription: "Write professional cover letters instantly",
    href: "/try/cover-letter",
    icon: FileText,
    iconColor: "blue",
    features: [
      "Personalized to each job",
      "ATS-friendly formatting",
      "Professional tone",
    ],
  },
  {
    title: "Job Fit Analysis",
    description: "See how well your resume matches a job description. Get a fit score and suggestions to improve your application.",
    shortDescription: "Check how well your resume matches a job",
    href: "/try/job-fit",
    icon: Target,
    iconColor: "green",
    features: [
      "Match percentage score",
      "Missing keywords identified",
      "Improvement suggestions",
    ],
  },
  {
    title: "Interview Prep Questions",
    description: "Get personalized interview questions based on the job description and your experience. Practice before the real thing.",
    shortDescription: "Get personalized interview questions",
    href: "/try/interview-prep",
    icon: MessageSquare,
    iconColor: "purple",
    features: [
      "Role-specific questions",
      "Behavioral & technical",
      "Tailored to your background",
    ],
  },
  {
    title: "Resume Roast",
    description: "Get brutally honest, entertaining feedback on your resume. Find out what recruiters really think.",
    shortDescription: "Get brutally honest resume feedback",
    href: "/roast-my-resume",
    icon: Flame,
    iconColor: "orange",
    features: [
      "Brutally honest feedback",
      "Shareable results",
      "Actionable improvements",
    ],
  },
]

// Only include roles that have actual pages
export const ROLE_LANDING_PAGES = [
  { name: "Software Engineer", slug: "software-engineer" },
  { name: "Product Manager", slug: "product-manager" },
  { name: "Data Analyst", slug: "data-analyst" },
] as const

export type RoleLandingPage = (typeof ROLE_LANDING_PAGES)[number]
