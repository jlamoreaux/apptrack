import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, BarChart3, Users, Calendar, FileText, TrendingUp, ArrowRight } from "lucide-react"
import { HomePricingSection } from "@/components/home-pricing-section"
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">JobTracker</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            Track Your Job Applications
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Land Your Dream Job
            <br />
            <span className="text-primary">Stay Organized</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Keep track of your job applications, interview schedules, and networking contacts all in one place. Never
            miss an opportunity again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Tracking Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Succeed</h2>
            <p className="text-muted-foreground text-lg">
              Powerful features to help you manage your job search effectively
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Application Tracking</CardTitle>
                <CardDescription>
                  Keep detailed records of every application with status updates, notes, and follow-up reminders.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Calendar className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Interview Management</CardTitle>
                <CardDescription>
                  Schedule interviews, prepare notes, and track your performance across multiple opportunities.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Contact Management</CardTitle>
                <CardDescription>
                  Build and maintain relationships with recruiters, hiring managers, and professional contacts.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Progress Analytics</CardTitle>
                <CardDescription>
                  Visualize your job search progress with charts and insights to optimize your strategy.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CheckCircle className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Status Updates</CardTitle>
                <CardDescription>
                  Real-time status tracking from application submission to offer negotiation.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Success Metrics</CardTitle>
                <CardDescription>
                  Track response rates, interview conversion, and identify what{"'"}s working best.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <HomePricingSection plans={plans} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of job seekers who are already using JobTracker to land their dream jobs.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Your Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 JobTracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
