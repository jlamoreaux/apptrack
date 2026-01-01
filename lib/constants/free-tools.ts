import { FileText, Target, MessageSquare, Flame, LucideIcon } from "lucide-react"

export interface FreeTool {
  title: string
  description: string
  shortDescription: string
  href: string
  icon: LucideIcon
  color: string
  bgColor: string
  features: string[]
}

export const FREE_TOOLS: FreeTool[] = [
  {
    title: "AI Cover Letter Generator",
    description: "Generate a personalized, professional cover letter tailored to any job description in 30 seconds.",
    shortDescription: "Write professional cover letters instantly",
    href: "/try/cover-letter",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
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
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
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
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
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
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
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
