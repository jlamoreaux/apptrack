import {
  FileText,
  Target,
  MessageSquare,
  Flame,
  DollarSign,
  Trophy,
  ClipboardList,
  MessageSquareText,
  Building2,
  LucideIcon,
} from "lucide-react"
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
    title: "Comp Tracker",
    description: "See your total comp, base plus bonus plus equity, projected over three years with vesting and valued at the live stock price. Try it without an account; sign up to keep it.",
    shortDescription: "Track your pay against the market",
    href: "/try/comp",
    icon: DollarSign,
    iconColor: "green",
    features: [
      "Three-year projection with vesting",
      "Live stock price simulator",
      "Market range for your role",
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

export interface AccountTool {
  title: string
  shortDescription: string
  href: string
  icon: LucideIcon
  iconColor: FeatureIconColor
}

// Tools that live in the app and need a (free) account. Listed on the
// marketing surfaces next to the try-without-signing-up tools so the whole
// product is discoverable from the nav; the middleware sends a logged-out
// visitor to login with a redirect back to the page they picked.
export const ACCOUNT_TOOLS: AccountTool[] = [
  {
    title: "Wins Log",
    shortDescription: "Log your wins and build your case",
    href: "/dashboard/wins",
    icon: Trophy,
    iconColor: "orange",
  },
  {
    title: "Review Prep",
    shortDescription: "Turn your wins into a review-ready doc",
    href: "/dashboard/review-prep",
    icon: ClipboardList,
    iconColor: "purple",
  },
  {
    title: "Career Coach",
    shortDescription: "Coaching grounded in your logged wins",
    href: "/dashboard/coach",
    icon: MessageSquareText,
    iconColor: "blue",
  },
  {
    title: "Application Tracker",
    shortDescription: "Track every application, free forever",
    href: "/dashboard/applications",
    icon: Building2,
    iconColor: "indigo",
  },
]

// Role-specific cover letter landing pages — each generates a pre-rendered SEO page
export const ROLE_LANDING_PAGES = [
  // Tech
  { name: "Software Engineer", slug: "software-engineer" },
  { name: "Product Manager", slug: "product-manager" },
  { name: "Data Analyst", slug: "data-analyst" },
  { name: "UX Designer", slug: "ux-designer" },
  { name: "Data Scientist", slug: "data-scientist" },
  { name: "DevOps Engineer", slug: "devops-engineer" },
  { name: "QA Engineer", slug: "qa-engineer" },
  { name: "Frontend Developer", slug: "frontend-developer" },
  { name: "Backend Developer", slug: "backend-developer" },
  { name: "Full Stack Developer", slug: "full-stack-developer" },
  { name: "Machine Learning Engineer", slug: "machine-learning-engineer" },
  { name: "Cybersecurity Analyst", slug: "cybersecurity-analyst" },
  { name: "Cloud Engineer", slug: "cloud-engineer" },
  { name: "iOS Developer", slug: "ios-developer" },
  { name: "Android Developer", slug: "android-developer" },
  // Business & Operations
  { name: "Business Analyst", slug: "business-analyst" },
  { name: "Project Manager", slug: "project-manager" },
  { name: "Operations Manager", slug: "operations-manager" },
  { name: "Supply Chain Manager", slug: "supply-chain-manager" },
  { name: "Financial Analyst", slug: "financial-analyst" },
  { name: "Accountant", slug: "accountant" },
  { name: "Human Resources Manager", slug: "human-resources-manager" },
  { name: "Recruiter", slug: "recruiter" },
  { name: "Executive Assistant", slug: "executive-assistant" },
  // Marketing & Sales
  { name: "Marketing Manager", slug: "marketing-manager" },
  { name: "Sales Representative", slug: "sales-representative" },
  { name: "Account Executive", slug: "account-executive" },
  { name: "Content Writer", slug: "content-writer" },
  { name: "Social Media Manager", slug: "social-media-manager" },
  { name: "Graphic Designer", slug: "graphic-designer" },
  { name: "Copywriter", slug: "copywriter" },
  // Healthcare
  { name: "Registered Nurse", slug: "registered-nurse" },
  { name: "Physical Therapist", slug: "physical-therapist" },
  { name: "Medical Assistant", slug: "medical-assistant" },
  // Education & Other
  { name: "Teacher", slug: "teacher" },
  { name: "Customer Success Manager", slug: "customer-success-manager" },
  { name: "Data Engineer", slug: "data-engineer" },
  { name: "Product Designer", slug: "product-designer" },
] as const

export type RoleLandingPage = (typeof ROLE_LANDING_PAGES)[number]
