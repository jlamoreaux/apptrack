import { Metadata } from "next"
import Link from "next/link"
import { NavigationStatic } from "@/components/navigation-static"
import { Card } from "@/components/ui/card"
import { FileText, Target, MessageSquare, Flame } from "lucide-react"

export const metadata: Metadata = {
  title: "Free Job Search Tools | AI Cover Letter, Resume Analysis & More | AppTrack",
  description: "Free AI-powered job search tools: cover letter generator, job fit analysis, interview prep questions, and resume roast. Try once daily without signing up.",
  keywords: [
    "free job search tools",
    "AI cover letter generator",
    "resume analyzer",
    "interview questions",
    "job application tools",
    "career tools",
  ],
  openGraph: {
    title: "Free Job Search Tools | AppTrack",
    description: "AI-powered tools to help you land your dream job. Try free daily.",
    url: "https://apptrack.ing/free-tools",
    siteName: "AppTrack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Job Search Tools | AppTrack",
    description: "AI-powered tools to help you land your dream job.",
  },
  alternates: {
    canonical: "https://apptrack.ing/free-tools",
  },
}

const tools = [
  {
    title: "AI Cover Letter Generator",
    description: "Generate a personalized, professional cover letter tailored to any job description in 30 seconds.",
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

const rolePages = [
  { name: "Software Engineer", slug: "software-engineer" },
  { name: "Product Manager", slug: "product-manager" },
  { name: "Data Analyst", slug: "data-analyst" },
]

export default function FreeToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Free Job Search Tools
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered tools to help you write better applications, prepare for interviews, and land your dream job. Try each tool once daily, free.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Card className="p-6 h-full hover:border-primary transition-colors cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${tool.bgColor}`}>
                    <tool.icon className={`h-6 w-6 ${tool.color}`} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2">{tool.title}</h2>
                    <p className="text-muted-foreground mb-4">{tool.description}</p>
                    <ul className="space-y-1">
                      {tool.features.map((feature, index) => (
                        <li key={index} className="text-sm flex items-center gap-2">
                          <span className={tool.color}>+</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Role-Specific Cover Letters */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Cover Letters by Role
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Get a cover letter template and tips specific to your target role
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {rolePages.map((role) => (
              <Link
                key={role.slug}
                href={`/cover-letter-generator/${role.slug}`}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                {role.name}
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-primary/5 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">
            Want Unlimited Access?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Sign up free to get unlimited access to all AI tools, track your job applications, and get personalized career coaching.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
          >
            Sign Up Free
          </Link>
        </section>
      </main>
    </div>
  )
}
