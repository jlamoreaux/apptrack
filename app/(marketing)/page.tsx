import Link from "next/link"
import { ArrowRight, FileText, MessageSquare, Brain, Target, Users, Sparkles, Check } from "lucide-react"
import { ButtonLink } from "@/components/ui/button-link"
import { NavigationServer } from "@/components/navigation-server"
import { HomePricingSection } from "@/components/home-pricing-section"
import { HomeFaq } from "@/components/home-faq"
import { HomepageClientWrapper } from "@/components/homepage-client-wrapper"
import { TestimonialSection } from "@/components/testimonials"
import { HeroContent } from "@/components/home-hero-variants"
import { COPY } from "@/lib/content/copy"
import { createClient } from "@/lib/supabase/server-client"
import { OrganizationSchema, SoftwareApplicationSchema, FAQSchema } from "@/components/seo/structured-data"
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ui/scroll-reveal"
import { HeroImageAnimated } from "@/components/hero-image-animated"
import { ProductShowcase } from "@/components/product-showcase"

async function getPlans() {
  try {
    const supabase = await createClient()
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true })

    if (error) {
      console.error("Failed to fetch subscription plans:", error)
      return []
    }

    return plans || []
  } catch (error) {
    console.error("Failed to fetch subscription plans:", error)
    return []
  }
}

const AI_TOOLS = [
  {
    id: "resume",
    title: "Resume Analysis",
    description: "Get AI-powered feedback with specific improvement suggestions",
    icon: Brain,
    href: "/signup",
    features: ["ATS optimization tips", "Keyword analysis", "Format recommendations"],
    badgeColor: "bg-badge-indigo",
    iconColor: "text-badge-indigo-fg",
    cta: "Get started free",
    bentoSpan: "lg:col-span-2" as const,  // Hero card
  },
  {
    id: "cover-letter",
    title: "Cover Letter Generator",
    description: "Create compelling, customized cover letters in seconds",
    icon: FileText,
    href: "/try/cover-letter",
    features: ["Personalized to job description", "Professional formatting"],
    badgeColor: "bg-badge-emerald",
    iconColor: "text-badge-emerald-fg",
    cta: "Try it free",
    bentoSpan: "" as const,
  },
  {
    id: "interview",
    title: "Interview Prep",
    description: "Practice with AI-generated questions tailored to your role",
    icon: MessageSquare,
    href: "/try/interview-prep",
    features: ["Role-specific questions", "STAR format guidance"],
    badgeColor: "bg-badge-orange",
    iconColor: "text-badge-orange-fg",
    cta: "Try it free",
    bentoSpan: "" as const,
  },
  {
    id: "job-fit",
    title: "Job Fit Analysis",
    description: "See how well your profile matches any job posting",
    icon: Target,
    href: "/try/job-fit",
    features: ["Skills match percentage", "Actionable next steps"],
    badgeColor: "bg-badge-violet",
    iconColor: "text-badge-violet-fg",
    cta: "Try it free",
    bentoSpan: "lg:col-span-2" as const,  // Wide card
  },
] as const

export default async function HomePage() {
  const plans = await getPlans()

  return (
    <HomepageClientWrapper>
      <OrganizationSchema />
      <SoftwareApplicationSchema />
      <FAQSchema faqs={COPY.faq.items} />
      <div className="min-h-screen flex flex-col">
        <NavigationServer variant="marketing" />
        <main id="main-content" className="flex-1">

        {/* ============================================================
            SECTION 1: HERO
            ============================================================ */}
        <section className="relative overflow-hidden">
          {/* Warm gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-surface-1 to-badge-indigo/40" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-badge-indigo/30 to-transparent" />

          <div className="relative container mx-auto px-4 py-16 sm:py-20 lg:py-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Copy */}
              <div className="text-center lg:text-left space-y-8 max-w-2xl mx-auto lg:mx-0">
                <div className="space-y-6">
                  <HeroContent />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <ButtonLink
                    href="/signup"
                    size="lg"
                    className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 active:scale-[0.98] text-base px-8"
                  >
                    Start Free — See Your Pipeline
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </ButtonLink>
                  <ButtonLink
                    href="/login"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-border text-foreground hover:bg-interactive-hover"
                  >
                    Sign In
                  </ButtonLink>
                </div>
              </div>

              {/* Right: Sankey chart screenshot */}
              <HeroImageAnimated />
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 2: SOCIAL PROOF BAR
            ============================================================ */}
        <section className="border-y border-border bg-surface-1">
          <ScrollReveal direction="none">
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">Join thousands</span> of job seekers tracking applications
                </span>
                <span className="hidden sm:inline text-border">|</span>
                <span>Free forever plan available</span>
                <span className="hidden sm:inline text-border">|</span>
                <span>AI coaching from $9/month</span>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ============================================================
            SECTION 3: PRODUCT SHOWCASE
            ============================================================ */}
        <section className="py-16 sm:py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <ScrollReveal>
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display mb-4">
                  Everything you need, nothing you don't
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  One place to organize your applications, track your progress, and get AI-powered career coaching.
                </p>
              </div>
            </ScrollReveal>

            <ProductShowcase />
          </div>
        </section>

        {/* ============================================================
            SECTION 4: AI TOOLS — BENTO GRID
            ============================================================ */}
        <section className="py-16 sm:py-20 px-4 bg-section-ai-tools">
          <div className="container mx-auto max-w-6xl">
            <ScrollReveal>
              <div className="text-center mb-12">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-badge-violet text-badge-violet-fg mb-4">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Powered
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display mb-4">
                  Your AI career coach, on demand
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Get expert help with every step of your job search. Try our free tools or upgrade to AI Coach for unlimited access.
                </p>
              </div>
            </ScrollReveal>

            <StaggerContainer staggerDelay={0.08} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AI_TOOLS.map((tool) => (
                <StaggerItem key={tool.id} className={tool.bentoSpan}>
                  <Link
                    href={"ctaHref" in tool ? (tool as any).ctaHref : tool.href}
                    className="group block h-full rounded-2xl border border-border bg-surface-1 p-5 lg:p-6 hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className={`rounded-xl ${tool.badgeColor} p-2.5 w-fit mb-3`}>
                      <tool.icon className={`h-5 w-5 ${tool.iconColor}`} />
                    </div>
                    <h3 className="font-semibold font-display text-base mb-1 group-hover:text-primary transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {tool.description}
                    </p>
                    <ul className="space-y-1.5 mb-3">
                      {tool.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <span className="inline-flex items-center text-sm font-medium text-primary group-hover:text-primary/80">
                      {tool.cta}
                      <ArrowRight className="ml-1.5 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>

            <ScrollReveal delay={0.3}>
              <div className="text-center mt-10">
                <p className="text-sm text-muted-foreground mb-4">
                  Like what you see? Sign up to save your results and unlock unlimited access.
                </p>
                <ButtonLink
                  href="/signup"
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
                >
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </ButtonLink>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ============================================================
            SECTION 5: TESTIMONIALS
            ============================================================ */}
        <TestimonialSection />

        {/* ============================================================
            SECTION 6: PRICING
            ============================================================ */}
        <ScrollReveal>
          <HomePricingSection plans={plans} />
        </ScrollReveal>

        {/* ============================================================
            SECTION 7: FAQ + FINAL CTA
            ============================================================ */}
        <HomeFaq />

        {/* Final CTA — Dark indigo section */}
        <section className="py-16 sm:py-20 px-4 bg-section-cta text-section-cta-foreground">
          <div className="container mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display mb-4">
                Ready to take control of your job search?
              </h2>
              <p className="text-lg text-section-cta-muted mb-8">
                Get organized, stay on track, and land your dream role with AI-powered assistance.
              </p>
              <ButtonLink
                href="/signup"
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/25 text-base px-8"
              >
                Start Your Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </ButtonLink>
              <p className="text-sm text-section-cta-muted mt-6">
                Start free • Upgrade anytime • Cancel when you get hired
              </p>
            </ScrollReveal>
          </div>
        </section>

      </main>
    </div>
    </HomepageClientWrapper>
  )
}
