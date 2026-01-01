import { Metadata } from "next"
import Link from "next/link"
import { NavigationStatic } from "@/components/navigation-static"
import { Card } from "@/components/ui/card"
import { ButtonLink } from "@/components/ui/button-link"
import { CheckList } from "@/components/ui/check-list"
import { FeatureIcon } from "@/components/ui/feature-icon"
import { WebPageSchema } from "@/components/seo/structured-data"
import { SITE_CONFIG } from "@/lib/constants/site-config"
import { FREE_TOOLS, ROLE_LANDING_PAGES } from "@/lib/constants/free-tools"

const canonicalUrl = `${SITE_CONFIG.url}/free-tools`

export const metadata: Metadata = {
  title: `Free Job Search Tools | AI Cover Letter, Resume Analysis & More | ${SITE_CONFIG.name}`,
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
    title: `Free Job Search Tools | ${SITE_CONFIG.name}`,
    description: "AI-powered tools to help you land your dream job. Try free daily.",
    url: canonicalUrl,
    siteName: SITE_CONFIG.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Free Job Search Tools | ${SITE_CONFIG.name}`,
    description: "AI-powered tools to help you land your dream job.",
  },
  alternates: {
    canonical: canonicalUrl,
  },
}

export default function FreeToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      <WebPageSchema
        title="Free Job Search Tools"
        description="AI-powered tools to help you land your dream job. Try free daily."
        url={canonicalUrl}
      />
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
          {FREE_TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Card className="p-6 h-full hover:border-primary transition-colors cursor-pointer">
                <div className="flex items-start gap-4">
                  <FeatureIcon icon={tool.icon} color={tool.iconColor} />
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2">{tool.title}</h2>
                    <p className="text-muted-foreground mb-4">{tool.description}</p>
                    <CheckList items={tool.features} />
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
            {ROLE_LANDING_PAGES.map((role) => (
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
          <ButtonLink href="/signup" size="lg">
            Sign Up Free
          </ButtonLink>
        </section>
      </main>
    </div>
  )
}
