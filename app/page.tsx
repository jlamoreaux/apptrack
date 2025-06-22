import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavigationStatic } from "@/components/navigation-static"
import { HomePricingSection } from "@/components/home-pricing-section"
import { Target, FileText, Users, Heart, BarChart3 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-primary/5">
      <NavigationStatic />
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <BarChart3 className="h-16 w-16 text-primary mr-4" />
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground">AppTrack</h1>
              </div>
              <p className="text-xl text-foreground max-w-2xl mx-auto">
                The smart way to track your job applications. Stay organized and never lose track of your job search
                progress. Start free with 5 applications, then upgrade to Pro for unlimited tracking.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-white">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-white"
                >
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Features Grid - Now before pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Track Applications</h3>
                <p className="text-sm text-muted-foreground">
                  Keep track of every application with company details, role information, and application dates.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center border border-secondary/20">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-foreground">Interview Notes</h3>
                <p className="text-sm text-muted-foreground">
                  Document interview experiences, questions asked, and follow-up actions.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Network Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  Save LinkedIn profiles and networking contacts for each application.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center border border-secondary/20">
                  <Heart className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-foreground">Ethical Billing</h3>
                <p className="text-sm text-muted-foreground">
                  We'll remind you to cancel your subscription when you get hired. We don't want you paying for
                  something you no longer need.
                </p>
              </div>
            </div>

            {/* Pricing Section - Now using the new component */}
            <HomePricingSection />
          </div>
        </div>
      </main>
    </div>
  )
}
