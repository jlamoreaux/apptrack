import { Metadata } from "next"
import Link from "next/link"
import { ButtonLink } from "@/components/ui/button-link"
import { NavigationStatic } from "@/components/navigation-static"
import { FAQSchema, HowToSchema } from "@/components/seo/structured-data"
import { SITE_CONFIG } from "@/lib/constants/site-config"
import { FREE_TOOLS } from "@/lib/constants/free-tools"

interface RoleLandingPageProps {
  role: string
  roleSlug: string
  description: string
  benefits: string[]
  exampleIntro: string
  exampleBody: string
  faqs: Array<{ question: string; answer: string }>
  relatedRoles: Array<{ name: string; slug: string }>
}

export function generateRoleMetadata(role: string, roleSlug: string): Metadata {
  const title = `Free ${role} Cover Letter Generator | ${SITE_CONFIG.name}`
  const description = `Generate a professional ${role} cover letter in 30 seconds. Our AI creates personalized, ATS-friendly cover letters tailored to ${role.toLowerCase()} positions.`
  const canonicalUrl = `${SITE_CONFIG.url}/cover-letter-generator/${roleSlug}`

  return {
    title,
    description,
    keywords: [
      `${role.toLowerCase()} cover letter`,
      `${role.toLowerCase()} cover letter example`,
      `${role.toLowerCase()} cover letter template`,
      "cover letter generator",
      "AI cover letter",
    ],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_CONFIG.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

export function RoleLandingPage({
  role,
  roleSlug,
  description,
  benefits,
  exampleIntro,
  exampleBody,
  faqs,
  relatedRoles,
}: RoleLandingPageProps) {
  const howToSteps = [
    { name: "Paste the job description", text: "Copy the job posting and paste it into the form" },
    { name: "Add your background", text: "Share your experience, skills, or paste your resume" },
    { name: "Generate your cover letter", text: "Get a personalized cover letter in seconds" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />

      <FAQSchema faqs={faqs} />
      <HowToSchema
        name={`How to Write a ${role} Cover Letter`}
        description={`Generate a professional ${role} cover letter using AI`}
        steps={howToSteps}
      />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {role} Cover Letter Generator
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            {description}
          </p>
          <ButtonLink
            href="/try/cover-letter"
            size="lg"
            className="bg-primary hover:bg-primary/90"
          >
            Generate Your Cover Letter Free
          </ButtonLink>
        </div>

        {/* Benefits Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Why Use Our {role} Cover Letter Generator?
          </h2>
          <ul className="space-y-3">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-primary font-bold">+</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Example Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            {role} Cover Letter Example
          </h2>
          <div className="bg-muted rounded-lg p-6 border">
            <p className="mb-4 text-muted-foreground italic">{exampleIntro}</p>
            <div className="bg-background rounded p-4 border">
              <p className="whitespace-pre-line text-sm">{exampleBody}</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mb-12 text-center bg-primary/5 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Write Your {role} Cover Letter?
          </h2>
          <p className="text-muted-foreground mb-6">
            Our AI will analyze the job description and create a personalized cover letter that highlights your relevant experience.
          </p>
          <ButtonLink
            href="/try/cover-letter"
            size="lg"
            className="bg-primary hover:bg-primary/90"
          >
            Try It Free
          </ButtonLink>
        </section>

        {/* FAQ Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Roles */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Cover Letters for Related Roles
          </h2>
          <div className="flex flex-wrap gap-3">
            {relatedRoles.map((relatedRole) => (
              <Link
                key={relatedRole.slug}
                href={`/cover-letter-generator/${relatedRole.slug}`}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
              >
                {relatedRole.name} Cover Letter
              </Link>
            ))}
          </div>
        </section>

        {/* Other Tools */}
        <section>
          <h2 className="text-2xl font-bold mb-6">
            More Free Job Search Tools
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {FREE_TOOLS.filter(tool => tool.href !== "/try/cover-letter").slice(0, 3).map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="p-4 border rounded-lg hover:border-primary transition-colors"
              >
                <h3 className="font-semibold mb-2">{tool.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {tool.shortDescription}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
