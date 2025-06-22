import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavigationStatic } from "@/components/navigation-static"
import { HomePricingSection } from "@/components/home-pricing-section"
import { BarChart3 } from "lucide-react"
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
      console.error("Error fetching plans:", error)
      return []
    }

    return plans || []
  } catch (error) {
    console.error("Exception fetching plans:", error)
    return []
  }
}

export default async function HomePage() {
  const plans = await getPlans()
  const features = getFeatures()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-primary/5">
      <NavigationStatic />
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <BarChart3 className="h-16 w-16 text-primary mr-4" />
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground">{COPY.hero.title}</h1>
              </div>
              <p className="text-xl text-foreground max-w-2xl mx-auto">{COPY.hero.subtitle}</p>
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

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
              {features.map((feature, index) => {
                const isSecondary = index % 2 === 1

                return (
                  <div key={feature.title} className="text-center space-y-4">
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

            <HomePricingSection plans={plans} />
          </div>
        </div>
      </main>
    </div>
  )
}
