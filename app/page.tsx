import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BarChart3, FileText, MessageSquare, Brain, Target, Users, Sparkles, Check, Bot } from "lucide-react"
import { ButtonLink } from "@/components/ui/button-link"
import { Button } from "@/components/ui/button"
import { NavigationServer } from "@/components/navigation-server"
import { HomePricingSection } from "@/components/home-pricing-section"
import { HomeFaq } from "@/components/home-faq"
import { HomepageClientWrapper } from "@/components/homepage-client-wrapper"
import { TestimonialSection } from "@/components/testimonials"
import { HeroContent } from "@/components/home-hero-variants"
import { COPY } from "@/lib/content/copy"
import { createClient } from "@/lib/supabase/server-client"
import { IMAGE_SIZES, IMAGE_QUALITY, IMAGE_QUALITY_HERO } from "@/lib/constants/homepage-content"
import { OrganizationSchema, SoftwareApplicationSchema, FAQSchema } from "@/components/seo/structured-data"
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ui/scroll-reveal"

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
    href: "/dashboard/resumes",
    features: ["ATS optimization tips", "Keyword analysis", "Format recommendations"],
    badgeColor: "bg-badge-indigo",
    iconColor: "text-indigo-600",
    cta: "Try it free",
  },
  {
    id: "cover-letter",
    title: "Cover Letter Generator",
    description: "Create compelling, customized cover letters in seconds",
    icon: FileText,
    href: "/try/cover-letter",
    features: ["Personalized to job description", "Professional formatting"],
    badgeColor: "bg-badge-emerald",
    iconColor: "text-emerald-600",
    cta: "Try it free",
  },
  {
    id: "interview",
    title: "Interview Prep",
    description: "Practice with AI-generated questions tailored to your role",
    icon: MessageSquare,
    href: "/try/interview-prep",
    features: ["Role-specific questions", "STAR format guidance"],
    badgeColor: "bg-badge-orange",
    iconColor: "text-orange-600",
    cta: "Try it free",
  },
  {
    id: "job-fit",
    title: "Job Fit Analysis",
    description: "See how well your profile matches any job posting",
    icon: Target,
    href: "/try/job-fit",
    features: ["Skills match percentage", "Actionable next steps"],
    badgeColor: "bg-badge-violet",
    iconColor: "text-violet-600",
    cta: "Try it free",
  },
  {
    id: "career-coach",
    title: "AI Career Coach",
    description: "Chat with an AI career advisor for personalized guidance",
    icon: Bot,
    href: "/dashboard/ai-coach",
    features: ["Personalized career advice", "Strategic job search planning"],
    badgeColor: "bg-badge-neutral",
    iconColor: "text-foreground",
    cta: "Learn more",
    ctaHref: "#pricing",
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
        <main className="flex-1">

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
                    className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-200 active:scale-[0.98] text-base px-8"
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
              <ScrollReveal direction="right" delay={0.2}>
                <div className="relative">
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/10 border border-border">
                    <Image
                      src="/screenshots/features/sankey-chart.png"
                      alt="AppTrack pipeline visualization showing how applications flow from Applied through Interview to Offer and Hired stages"
                      width={800}
                      height={500}
                      className="w-full h-auto"
                      priority
                      sizes={IMAGE_SIZES}
                      quality={IMAGE_QUALITY_HERO}
                    />
                  </div>
                  {/* Floating label */}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-surface-1 rounded-full px-4 py-2 shadow-lg border border-border text-sm font-medium text-muted-foreground">
                    <Sparkles className="inline h-4 w-4 text-indigo-500 mr-1.5" />
                    Your pipeline, visualized
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 2: SOCIAL PROOF BAR
            ============================================================ */}
        <section className="border-y border-border bg-surface-1">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <span className="font-semibold text-foreground">Join thousands</span> of job seekers tracking applications
              </span>
              <span className="hidden sm:inline text-border">|</span>
              <span>Free forever plan available</span>
              <span className="hidden sm:inline text-border">|</span>
              <span>AI coaching from $9/month</span>
            </div>
          </div>
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

            {/* Feature highlights — compact grid, no height matching */}
            <StaggerContainer className="space-y-6" staggerDelay={0.1}>
              {/* Pipeline Visualization - full width featured card */}
              <StaggerItem>
                <div className="group rounded-2xl border border-border bg-gradient-to-br from-badge-indigo/50 to-surface-1 p-6 sm:p-8 hover:shadow-card-hover transition-all duration-300">
                  <div className="grid lg:grid-cols-5 gap-6 items-center">
                    <div className="lg:col-span-2 space-y-3">
                      <div className="rounded-xl bg-badge-indigo p-2.5 w-fit">
                        <BarChart3 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <h3 className="text-xl font-semibold font-display">Pipeline Visualization</h3>
                      <p className="text-muted-foreground">See exactly where applications succeed or drop off with interactive Sankey charts — a feature no competitor offers.</p>
                      <ul className="space-y-1.5">
                        <li className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          See conversion rates at each stage
                        </li>
                        <li className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          Identify bottlenecks in your process
                        </li>
                        <li className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          Track progress over time
                        </li>
                      </ul>
                    </div>
                    <div className="lg:col-span-3">
                      <div className="rounded-lg overflow-hidden border border-border">
                        <Image
                          src="/screenshots/features/sankey-chart.png"
                          alt="Application Pipeline Sankey Chart"
                          width={800}
                          height={500}
                          className="w-full h-auto"
                          sizes="(max-width: 768px) 100vw, 60vw"
                          quality={IMAGE_QUALITY}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* Feature cards - 2x2 grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StaggerItem>
                  <div className="group rounded-2xl border border-border bg-surface-1 p-5 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 h-full">
                    <div className="rounded-xl bg-badge-emerald p-2.5 w-fit mb-3">
                      <Check className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="text-base font-semibold font-display mb-1">Smart Tracking</h3>
                    <p className="text-sm text-muted-foreground">Track every application with status updates, interview notes, and recruiter contacts.</p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="group rounded-2xl border border-border bg-surface-1 p-5 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 h-full">
                    <div className="rounded-xl bg-badge-violet p-2.5 w-fit mb-3">
                      <Sparkles className="h-5 w-5 text-violet-600" />
                    </div>
                    <h3 className="text-base font-semibold font-display mb-1">AI Career Coaching</h3>
                    <p className="text-sm text-muted-foreground">Resume analysis, cover letters, interview prep, and job fit scoring — powered by AI.</p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="group rounded-2xl border border-border bg-surface-1 p-5 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 h-full">
                    <div className="rounded-xl bg-badge-orange p-2.5 w-fit mb-3">
                      <Target className="h-5 w-5 text-orange-600" />
                    </div>
                    <h3 className="text-base font-semibold font-display mb-1">Browser Extension</h3>
                    <p className="text-sm text-muted-foreground">Save jobs from any site with one click. Auto-extract details instantly.</p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="group rounded-2xl border border-border bg-surface-1 p-5 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 h-full">
                    <div className="rounded-xl bg-badge-neutral p-2.5 w-fit mb-3">
                      <Users className="h-5 w-5 text-stone-600" />
                    </div>
                    <h3 className="text-base font-semibold font-display mb-1">Contact Management</h3>
                    <p className="text-sm text-muted-foreground">Store recruiter contacts, LinkedIn profiles, and networking connections.</p>
                  </div>
                </StaggerItem>
              </div>
            </StaggerContainer>
          </div>
        </section>

        {/* ============================================================
            SECTION 4: AI TOOLS — BENTO GRID
            ============================================================ */}
        <section className="py-16 sm:py-20 px-4 bg-section-muted">
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

            <StaggerContainer staggerDelay={0.08}>
              {/* Row 1: First 3 tools */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {AI_TOOLS.slice(0, 3).map((tool) => (
                  <StaggerItem key={tool.id}>
                    <Link
                      href={"ctaHref" in tool ? (tool as any).ctaHref : tool.href}
                      className="group block h-full rounded-2xl border border-border bg-surface-1 p-5 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5"
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
              </div>
              {/* Row 2: Last 2 tools — centered */}
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {AI_TOOLS.slice(3).map((tool) => (
                  <StaggerItem key={tool.id}>
                    <Link
                      href={"ctaHref" in tool ? (tool as any).ctaHref : tool.href}
                      className="group block h-full rounded-2xl border border-border bg-surface-1 p-5 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5"
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
              </div>
            </StaggerContainer>

            <ScrollReveal delay={0.3}>
              <div className="text-center mt-10">
                <p className="text-sm text-muted-foreground mb-4">
                  Like what you see? Sign up to save your results and unlock unlimited access.
                </p>
                <ButtonLink
                  href="/signup"
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-orange-500/20"
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
        <HomePricingSection plans={plans} />

        {/* ============================================================
            SECTION 7: FAQ + FINAL CTA
            ============================================================ */}
        <HomeFaq />

        {/* Final CTA — Dark indigo section */}
        <section className="py-16 sm:py-20 px-4 bg-indigo-950 text-white">
          <div className="container mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display mb-4">
                Ready to take control of your job search?
              </h2>
              <p className="text-lg text-indigo-200 mb-8">
                Get organized, stay on track, and land your dream role with AI-powered assistance.
              </p>
              <ButtonLink
                href="/signup"
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white shadow-lg shadow-orange-500/25 text-base px-8"
              >
                Start Your Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </ButtonLink>
              <p className="text-sm text-indigo-300 mt-6">
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
