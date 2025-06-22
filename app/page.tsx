import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavigationStatic } from "@/components/navigation-static"
import { HomePricingSection } from "@/components/home-pricing-section"
import { Target, FileText, Users, Heart, BarChart3 } from "lucide-react"
import { SITE_CONFIG } from "@/lib/constants/site-config"
import { createClient } from "@/lib/supabase/server-client"

async function getPlans() {
  try {
    const supabase = await createClient()
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("price_monthly", { ascending: true })

    if (error) {
      console.error("Error fetching plans:", error)
      return []
    }

    return plans || []
  } catch (error) {
    console.error("Exception fetching plans:", error)
    return []
  }
}

// Icon mapping for features
const iconMap = {
  Target,
  FileText,
  Users,
  Heart,
} as const

export default async function HomePage() {
  const plans = await getPlans()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-primary/5">
      <NavigationStatic />
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <BarChart3 className="h-16 w-16 text-primary mr-4" />
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground">
                  {SITE_CONFIG.copy.hero.title}
                </h1>
              </div>
              <p className="text-xl text-foreground max-w-2xl mx-auto">{SITE_CONFIG.copy.hero.subtitle}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-white">
                  {SITE_CONFIG.copy.hero.cta.primary}
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-white"
                >
                  {SITE_CONFIG.copy.hero.cta.secondary}
                </Button>
              </Link>
            </div>

            {/* Features Grid - Using site config */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
              {SITE_CONFIG.features.core.map((feature, index) => {
                const IconComponent = iconMap[feature.icon as keyof typeof iconMap]
                const isSecondary = index % 2 === 1

                return (
                  <div key={feature.title} className="text-center space-y-4">
                    <div
                      className={`mx-auto w-12 h-12 ${isSecondary ? "bg-secondary/10 border-secondary/20" : "bg-primary/10 border-primary/20"} rounded-lg flex items-center justify-center border`}
                    >
                      <IconComponent className={`h-6 w-6 ${isSecondary ? "text-secondary" : "text-primary"}`} />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                )
              })}
            </div>

            {/* Pricing Section - Using database data */}
            <HomePricingSection plans={plans} />
          </div>
        </div>
      </main>
    </div>
  )
}
