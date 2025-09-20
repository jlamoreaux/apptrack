import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavigationStatic } from "@/components/navigation-static"
import { HomePricingSection } from "@/components/home-pricing-section"
import { HomeProblemSolution } from "@/components/home-problem-solution"
import { HomeSocialProof } from "@/components/home-social-proof"
import { HomeFaq } from "@/components/home-faq"
import { HomeFinalCta } from "@/components/home-final-cta"
import { COPY } from "@/lib/content/copy"
import { getFeatures } from "@/lib/content/features"
import { createClient } from "@/lib/supabase/server-client"

async function getPlans() {
  try {
    const supabase = await createClient()
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("price_monthly", { ascending: true })

    if (error) {
      return []
    }

    return plans || []
  } catch (error) {
    return []
  }
}

export default async function HomePage() {
  const plans = await getPlans()
  const features = getFeatures()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-primary/5">
      <NavigationStatic />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <div className="text-center space-y-8 max-w-4xl mx-auto">
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-foreground text-center mb-6">
                  {COPY.hero.title}
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-foreground max-w-xl sm:max-w-3xl mx-auto px-4 sm:px-0">
                  {COPY.hero.subtitle}
                </p>
                <p className="text-sm font-medium text-primary">
                  {COPY.hero.stats}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-white">
                    {COPY.hero.cta.primary}
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    {COPY.hero.cta.secondary}
                  </Button>
                </Link>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {COPY.hero.supportingText}
              </p>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <HomeProblemSolution />

        {/* Features Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12">
              {COPY.features.title}
            </h2>
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

        {/* Social Proof Section - Hidden for now */}
        {/* <HomeSocialProof /> */}

        {/* Pricing Section */}
        <div className="py-16 px-4">
          <HomePricingSection plans={plans} />
        </div>

        {/* FAQ Section */}
        <HomeFaq />

        {/* Final CTA Section */}
        <HomeFinalCta />
      </main>
    </div>
  )
}