import Image from "next/image"
import { ButtonLink } from "@/components/ui/button-link"
import { CheckList } from "@/components/ui/check-list"
import { NavigationStatic } from "@/components/navigation-static"
import { HomePricingSection } from "@/components/home-pricing-section"
import { HomeProblemSolution } from "@/components/home-problem-solution"
import { HomeFaq } from "@/components/home-faq"
import { HomeFinalCta } from "@/components/home-final-cta"
import { HomepageClientWrapper } from "@/components/homepage-client-wrapper"
import { HomeAICoachSection } from "@/components/home-ai-coach-section"
import { TestimonialSection } from "@/components/testimonials"
import { HeroContent } from "@/components/home-hero-variants"
import { HomeTryAISection } from "@/components/home-try-ai-section"
import { COPY } from "@/lib/content/copy"
import { getFeatures } from "@/lib/content/features"
import { createClient } from "@/lib/supabase/server-client"
import { SCREENSHOT_STYLES, FEATURE_SECTIONS } from "@/lib/constants/homepage-content"

async function getPlans() {
  try {
    const supabase = await createClient()
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
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

export default async function HomePage() {
  const plans = await getPlans()
  const features = getFeatures()

  return (
    <HomepageClientWrapper>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-primary/5">
        <NavigationStatic />
        <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left side - Text content */}
              <div className="text-center lg:text-left space-y-8 max-w-xl mx-auto lg:mx-0">
                <div className="space-y-4">
                  <HeroContent />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <ButtonLink 
                    href="/signup" 
                    size="lg" 
                    className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-white"
                  >
                    {COPY.hero.cta.primary}
                  </ButtonLink>
                  <ButtonLink
                    href="/login"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    {COPY.hero.cta.secondary}
                  </ButtonLink>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {COPY.hero.supportingText}
                </p>
              </div>

              {/* Right side - Screenshot with MacBook frame */}
              <div className="relative">
                <Image
                  src="/screenshots/hero/dashboard-desktop.png"
                  alt="AppTrack Dashboard showing job applications organized in columns with status tracking"
                  width={1200}
                  height={750}
                  className="w-full h-auto"
                  priority
                  style={SCREENSHOT_STYLES}
                />
                <p className="text-center text-sm text-muted-foreground mt-4">
                  See all your applications organized in one clean dashboard
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <HomeProblemSolution />

        {/* Try AI Features Free Section */}
        <HomeTryAISection />

        {/* Features Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12">
              {COPY.features.title}
            </h2>
            
            {/* Sankey Chart Feature Highlight */}
            <div className="mb-16">
              <div className="grid lg:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
                <div className="relative order-2 lg:order-1">
                  <Image
                    src="/screenshots/features/sankey-chart.png"
                    alt="Application Pipeline Sankey Chart"
                    width={800}
                    height={500}
                    className="w-full h-auto"
                  />
                </div>
                <div className="space-y-4 order-1 lg:order-2">
                  <h3 className="text-2xl font-bold text-foreground">{FEATURE_SECTIONS.sankey.title}</h3>
                  <p className="text-lg text-muted-foreground">
                    {FEATURE_SECTIONS.sankey.description}
                  </p>
                  <CheckList items={FEATURE_SECTIONS.sankey.features} />
                </div>
              </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 justify-items-center px-4 sm:px-0">
              {features.map((feature, index) => {
                const isSecondary = index % 2 === 1

                return (
                  <div key={feature.title} className="text-center space-y-4 w-full max-w-[280px] sm:max-w-xs">
                    <div
                      className={`mx-auto w-12 h-12 ${isSecondary ? "bg-secondary/10 border-secondary/20" : "bg-primary/10 border-primary/20"} rounded-lg flex items-center justify-center border`}
                    >
                      <feature.IconComponent className={`h-6 w-6 ${isSecondary ? "text-secondary" : "text-primary"}`} />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Interview Prep Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {FEATURE_SECTIONS.interviewPrep.title}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {FEATURE_SECTIONS.interviewPrep.description}
                </p>
                <CheckList items={FEATURE_SECTIONS.interviewPrep.features} />
              </div>
              <div className="relative">
                <Image
                  src="/screenshots/features/interview-prep.png"
                  alt="AI Interview Preparation"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                  style={SCREENSHOT_STYLES}
                />
              </div>
            </div>
          </div>
        </section>

        {/* AI Coach Feature Showcase */}
        <HomeAICoachSection />

        {/* Mobile Responsive Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="order-2 lg:order-1">
                <div className="relative mx-auto max-w-sm">
                  <Image
                    src="/screenshots/devices/mobile-dashboard.png"
                    alt="AppTrack Mobile Dashboard"
                    width={400}
                    height={800}
                    className="w-full h-auto"
                  />
                </div>
              </div>
              <div className="order-1 lg:order-2 space-y-4 text-center lg:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {FEATURE_SECTIONS.mobile.title}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {FEATURE_SECTIONS.mobile.description}
                </p>
                <CheckList items={FEATURE_SECTIONS.mobile.features} className="text-left" />
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <TestimonialSection />

        {/* Pricing Section */}
        <HomePricingSection plans={plans} />

        {/* FAQ Section */}
        <HomeFaq />

        {/* Final CTA Section */}
        <HomeFinalCta />
      </main>
    </div>
    </HomepageClientWrapper>
  )
}